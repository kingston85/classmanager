import 'dart:math';
import 'models.dart';

final _rng = Random.secure();
const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

String uid() => List.generate(10, (_) => _rng.nextInt(36).toRadixString(36)).join();
String genPin() => (100000 + _rng.nextInt(900000)).toString();
String toIso(DateTime d) => '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';
String todayIso() => toIso(DateTime.now());
double round1(double n, [int dp = 1]) {
  final f = pow(10, dp).toDouble();
  return (n * f).round() / f;
}

Course blankCourse(String lecturer) => Course(
      id: uid(), lecturer: lecturer, startDate: todayIso(), createdAt: DateTime.now().toIso8601String(), scale: defaultScale());

GradeBand? letterFor(double? pct, List<GradeBand> scale) {
  if (pct == null || scale.isEmpty) return null;
  final sorted = [...scale]..sort((a, b) => b.min.compareTo(a.min));
  for (final b in sorted) {
    if (pct + 1e-9 >= b.min) return b;
  }
  return sorted.last;
}

List<Session> generateSessions(Course c) {
  final out = <Session>[];
  if (c.days.isEmpty) return out;
  final start = DateTime.parse(c.startDate);
  for (var i = 0; i < c.weeks * 7; i++) {
    final d = DateTime(start.year, start.month, start.day + i);
    if (c.days.contains(d.weekday % 7)) out.add(Session(id: uid(), date: toIso(d)));
  }
  return out;
}

class AttStats {
  int present = 0, late = 0, absent = 0, excused = 0;
  int get counted => present + late + absent;
  int get marked => counted + excused;
  double? get pct => counted == 0 ? null : (present + 0.5 * late) / counted * 100;
}

AttStats attendanceStats(Course c, String sid) {
  final a = AttStats();
  for (final s in c.sessions) {
    switch (s.records[sid]) {
      case 'P': a.present++; break;
      case 'L': a.late++; break;
      case 'A': a.absent++; break;
      case 'E': a.excused++; break;
    }
  }
  return a;
}

bool isGraded(Course c, Assessment a) => (c.scores[a.id] ?? {}).values.any((v) => v != null);

class StudentResult {
  final String studentId;
  double earned = 0, gradedWeight = 0, totalWeight = 0;
  double? standing, projected, attendancePct;
  String letter = '–';
  double? points;
  int? rank;
  StudentResult(this.studentId);
}

StudentResult studentResult(Course c, String sid) {
  final r = StudentResult(sid);
  for (final a in c.assessments) {
    r.totalWeight += a.weight;
    final v = c.scores[a.id]?[sid];
    if (v != null && a.max > 0) {
      r.earned += v / a.max * a.weight;
      r.gradedWeight += a.weight;
    }
  }
  final att = attendanceStats(c, sid);
  if (c.attendanceWeight > 0) {
    r.totalWeight += c.attendanceWeight;
    if (att.pct != null) {
      r.earned += att.pct! / 100 * c.attendanceWeight;
      r.gradedWeight += c.attendanceWeight;
    }
  }
  r.standing = r.gradedWeight > 0 ? r.earned / r.gradedWeight * 100 : null;
  r.projected = r.totalWeight > 0 ? r.earned / r.totalWeight * 100 : null;
  r.attendancePct = att.pct;
  final band = letterFor(r.standing, c.scale);
  r.letter = band?.letter ?? '–';
  r.points = band?.points;
  return r;
}

List<StudentResult> classResults(Course c) {
  final results = c.students.map((s) => studentResult(c, s.id)).toList();
  final ranked = results.where((r) => r.standing != null).toList()..sort((a, b) => b.standing!.compareTo(a.standing!));
  var last = 0;
  for (var i = 0; i < ranked.length; i++) {
    if (i > 0 && (ranked[i].standing! - ranked[i - 1].standing!).abs() < 1e-9) {
      ranked[i].rank = last;
    } else {
      ranked[i].rank = i + 1;
      last = i + 1;
    }
  }
  return results;
}

class AssessmentStats {
  int n = 0;
  double mean = 0, median = 0, high = 0, low = 0, sd = 0, passRate = 0;
  List<int> histogram = List.filled(10, 0);
}

AssessmentStats? assessmentStats(Course c, Assessment a) {
  final ids = c.students.map((s) => s.id).toSet();
  final vals = <double>[];
  (c.scores[a.id] ?? {}).forEach((k, v) {
    if (ids.contains(k) && v != null && a.max > 0) vals.add(v);
  });
  if (vals.isEmpty) return null;
  final s = AssessmentStats()..n = vals.length;
  s.mean = vals.reduce((x, y) => x + y) / s.n;
  final sorted = [...vals]..sort();
  s.median = s.n.isOdd ? sorted[(s.n - 1) ~/ 2] : (sorted[s.n ~/ 2 - 1] + sorted[s.n ~/ 2]) / 2;
  s.sd = sqrt(vals.fold<double>(0, (t, v) => t + pow(v - s.mean, 2)) / s.n);
  s.high = sorted.last;
  s.low = sorted.first;
  for (final v in vals) {
    final bin = (v / a.max * 10).floor().clamp(0, 9).toInt();
    s.histogram[bin]++;
  }
  s.passRate = vals.where((v) => v / a.max >= 0.6).length / s.n * 100;
  return s;
}

class RiskEntry {
  final Student student;
  final List<String> reasons;
  final double? attendancePct, standing;
  final double severity;
  RiskEntry(this.student, this.reasons, this.attendancePct, this.standing, this.severity);
}

List<RiskEntry> atRisk(Course c) {
  final out = <RiskEntry>[];
  for (final s in c.students) {
    final r = studentResult(c, s.id);
    final reasons = <String>[];
    var sev = 0.0;
    if (r.attendancePct != null && r.attendancePct! < c.riskAttendance) {
      reasons.add('Attendance ${round1(r.attendancePct!)}% (below ${c.riskAttendance.round()}%)');
      sev += c.riskAttendance - r.attendancePct!;
    }
    if (r.standing != null && r.standing! < c.riskStanding) {
      reasons.add('Standing ${round1(r.standing!)}% (below ${c.riskStanding.round()}%)');
      sev += c.riskStanding - r.standing!;
    }
    final missing = c.assessments.where((a) => isGraded(c, a) && c.scores[a.id]?[s.id] == null).length;
    if (missing > 0) {
      reasons.add('$missing graded assessment${missing > 1 ? 's' : ''} with no score');
      sev += missing * 5;
    }
    if (reasons.isNotEmpty) out.add(RiskEntry(s, reasons, r.attendancePct, r.standing, sev));
  }
  out.sort((a, b) => b.severity.compareTo(a.severity));
  return out;
}

// ---- CSV ----

String csvEscape(dynamic v) {
  final s = v == null ? '' : v.toString();
  return RegExp(r'[",\n\r]').hasMatch(s) ? '"${s.replaceAll('"', '""')}"' : s;
}

String toCsv(List<List<dynamic>> rows) => rows.map((r) => r.map(csvEscape).join(',')).join('\r\n');

List<List<String>> parseCsv(String text) {
  final rows = <List<String>>[];
  var row = <String>[];
  var cur = StringBuffer();
  var inQ = false;
  void endRow() {
    row.add(cur.toString());
    cur = StringBuffer();
    if (row.any((x) => x.trim().isNotEmpty)) rows.add(row);
    row = <String>[];
  }

  for (var i = 0; i < text.length; i++) {
    final ch = text[i];
    if (inQ) {
      if (ch == '"' && i + 1 < text.length && text[i + 1] == '"') {
        cur.write('"');
        i++;
      } else if (ch == '"') {
        inQ = false;
      } else {
        cur.write(ch);
      }
    } else if (ch == '"') {
      inQ = true;
    } else if (ch == ',' || ch == '\t') {
      row.add(cur.toString());
      cur = StringBuffer();
    } else if (ch == '\n' || ch == '\r') {
      if (ch == '\r' && i + 1 < text.length && text[i + 1] == '\n') i++;
      endRow();
    } else {
      cur.write(ch);
    }
  }
  endRow();
  return rows.map((r) => r.map((x) => x.trim()).toList()).toList();
}

class RosterRow {
  final String studentNo, name;
  final String? email, phone;
  RosterRow(this.studentNo, this.name, this.email, this.phone);
}

List<RosterRow> parseRoster(String text) {
  final rows = parseCsv(text);
  final out = <RosterRow>[];
  for (var i = 0; i < rows.length; i++) {
    final r = rows[i];
    if (i == 0 && r.length > 1 && RegExp(r'^(student|id|no|#)', caseSensitive: false).hasMatch(r[0]) && RegExp('name', caseSensitive: false).hasMatch(r[1])) continue;
    if (r.length < 2 || r[0].isEmpty || r[1].isEmpty) continue;
    out.add(RosterRow(r[0], r[1], r.length > 2 && r[2].isNotEmpty ? r[2] : null, r.length > 3 && r[3].isNotEmpty ? r[3] : null));
  }
  return out;
}
