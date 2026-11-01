import 'package:flutter_test/flutter_test.dart';
import 'package:classmanager/logic.dart';
import 'package:classmanager/models.dart';
import 'package:classmanager/services/share_service.dart';

Course sample() {
  final c = blankCourse('Dr. Test')
    ..code = 'ESEM 303'
    ..startDate = '2026-09-07'
    ..weeks = 2;
  c.students = [
    Student(id: 's1', studentNo: '1001', name: 'Ama', pin: '111111'),
    Student(id: 's2', studentNo: '1002', name: 'Kofi', pin: '222222'),
    Student(id: 's3', studentNo: '1003', name: 'Zainab', pin: '333333'),
  ];
  c.assessments = [
    Assessment(id: 'a1', name: 'Test 1', category: 'Test', max: 20, weight: 20),
    Assessment(id: 'a2', name: 'Final', category: 'Exam', max: 100, weight: 80),
  ];
  c.scores = {
    'a1': {'s1': 18, 's2': 10, 's3': 18},
    'a2': {},
  };
  return c;
}

void main() {
  test('letters follow the scale', () {
    expect(letterFor(95, defaultScale())?.letter, 'A');
    expect(letterFor(89.9, defaultScale())?.letter, 'B');
    expect(letterFor(12, defaultScale())?.letter, 'F');
    expect(letterFor(null, defaultScale()), isNull);
  });

  test('standing is over graded work, projected over all work', () {
    final r = studentResult(sample(), 's1');
    expect(r.earned, closeTo(18, 1e-9));
    expect(r.standing, closeTo(90, 1e-9));
    expect(r.projected, closeTo(18, 1e-9));
    expect(r.letter, 'A');
  });

  test('ties share a rank', () {
    final res = classResults(sample());
    expect(res.firstWhere((r) => r.studentId == 's1').rank, 1);
    expect(res.firstWhere((r) => r.studentId == 's3').rank, 1);
    expect(res.firstWhere((r) => r.studentId == 's2').rank, 3);
  });

  test('sessions fall on scheduled weekdays', () {
    final s = generateSessions(sample());
    expect(s.length, 6);
    expect(s.first.date, '2026-09-07');
    expect(s.last.date, '2026-09-18');
  });

  test('late counts half, excused is ignored', () {
    final c = sample();
    c.sessions = [
      for (final e in ['P', 'L', 'A', 'E'].asMap().entries) Session(id: 'q${e.key}', date: '2026-09-0${e.key + 1}', records: {'s1': e.value}),
    ];
    final a = attendanceStats(c, 's1');
    expect(a.counted, 3);
    expect(a.pct, closeTo(50, 1e-9));
  });

  test('csv round trip and roster parsing', () {
    final rows = [
      ['a', 'b,c', 'd"e'],
      ['1', '', '3'],
    ];
    expect(parseCsv(toCsv(rows)), rows);
    expect(parseRoster('Student No,Name\n1001,Ama Doe,ama@x.com\n1002,Kofi').length, 2);
  });

  test('share bundle opens only with the right PIN', () async {
    final c = sample();
    final bundle = await buildShareBundle(c);
    final mine = await openEntry(bundle, '1001', '111111');
    expect(mine?.name, 'Ama');
    expect(await openEntry(bundle, '1001', '222222'), isNull);
    expect(await openEntry(bundle, '9999', '111111'), isNull);
  });

  test('json round trip keeps scores', () {
    final c = sample();
    final back = Course.fromJson(c.toJson());
    expect(back.scores['a1']!['s1'], 18);
    expect(back.students.length, 3);
  });
}
