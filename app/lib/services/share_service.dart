import 'dart:convert';
import 'dart:math';
import 'dart:typed_data';
import 'package:cryptography/cryptography.dart';
import '../logic.dart';
import '../models.dart';

// Same format as the web app (web/src/share.ts):
// PBKDF2-HMAC-SHA256, 100,000 iterations -> AES-256-GCM, 12-byte IV, 16-byte tag appended to the ciphertext.
const pbkdf2Iterations = 100000;

Future<SecretKey> _key(String pin, List<int> salt) {
  final kdf = Pbkdf2(macAlgorithm: Hmac.sha256(), iterations: pbkdf2Iterations, bits: 256);
  return kdf.deriveKeyFromPassword(password: pin, nonce: salt);
}

Uint8List _randomBytes(int n) {
  final r = Random.secure();
  return Uint8List.fromList(List.generate(n, (_) => r.nextInt(256)));
}

Map<String, dynamic> studentViewJson(Course c, String sid) {
  final st = c.students.firstWhere((s) => s.id == sid);
  final results = classResults(c);
  final mine = results.firstWhere((r) => r.studentId == sid);
  final sessions = [...c.sessions]..sort((a, b) => a.date.compareTo(b.date));
  return {
    'name': st.name,
    'studentNo': st.studentNo,
    'attendance': sessions.map((s) => {'date': s.date, 'topic': s.topic, 'status': s.records[sid] ?? ''}).toList(),
    'attendancePct': mine.attendancePct,
    'assessments': c.assessments
        .map((a) => {'name': a.name, 'category': a.category, 'max': a.max, 'weight': a.weight, 'score': c.scores[a.id]?[sid], if (a.date != null) 'date': a.date})
        .toList(),
    'standing': mine.standing,
    'projected': mine.projected,
    'letter': mine.letter,
    'rank': mine.rank,
    'classSize': c.students.length,
  };
}

Future<Map<String, dynamic>> buildShareBundle(Course c) async {
  final aes = AesGcm.with256bits();
  final entries = <Map<String, dynamic>>[];
  for (final s in c.students) {
    final salt = _randomBytes(16);
    final iv = _randomBytes(12);
    final box = await aes.encrypt(utf8.encode(jsonEncode(studentViewJson(c, s.id))), secretKey: await _key(s.pin, salt), nonce: iv);
    entries.add({
      'studentNo': s.studentNo,
      'salt': base64Encode(salt),
      'iv': base64Encode(iv),
      'data': base64Encode([...box.cipherText, ...box.mac.bytes]),
    });
  }
  final ann = [...c.announcements]..sort((a, b) {
      final p = (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0);
      return p != 0 ? p : b.date.compareTo(a.date);
    });
  return {
    'format': 'classmanager-share',
    'v': 1,
    'publishedAt': DateTime.now().toUtc().toIso8601String(),
    'course': {'code': c.code, 'title': c.title, 'section': c.section, 'semester': c.semester, 'lecturer': c.lecturer, 'room': c.room, 'time': c.time},
    'announcements': ann.map((a) => a.toJson()).toList(),
    'entries': entries,
  };
}

bool isShareBundle(dynamic x) => x is Map && x['format'] == 'classmanager-share' && x['v'] == 1 && x['entries'] is List;

/// Returns null when the student number or PIN is wrong.
Future<StudentView?> openEntry(Map<String, dynamic> bundle, String studentNo, String pin) async {
  final entries = (bundle['entries'] as List).cast<Map>();
  final wanted = studentNo.trim().toLowerCase();
  final idx = entries.indexWhere((e) => (e['studentNo'] as String).trim().toLowerCase() == wanted);
  if (idx < 0) return null;
  final e = entries[idx];
  try {
    final all = base64Decode(e['data'] as String);
    final cipher = all.sublist(0, all.length - 16);
    final mac = Mac(all.sublist(all.length - 16));
    final plain = await AesGcm.with256bits().decrypt(
      SecretBox(cipher, nonce: base64Decode(e['iv'] as String), mac: mac),
      secretKey: await _key(pin.trim(), base64Decode(e['salt'] as String)),
    );
    return StudentView.fromJson(jsonDecode(utf8.decode(plain)) as Map<String, dynamic>);
  } catch (_) {
    return null;
  }
}
