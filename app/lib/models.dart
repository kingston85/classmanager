// Data model. The JSON layout is identical to the web app's backup format
// (web/src/types.ts), so a backup made in one app opens in the other.

double _d(dynamic v) => (v as num).toDouble();

class Student {
  String id, studentNo, name, pin;
  String? email, phone;
  Student({required this.id, required this.studentNo, required this.name, required this.pin, this.email, this.phone});
  factory Student.fromJson(Map<String, dynamic> j) => Student(
        id: j['id'], studentNo: j['studentNo'], name: j['name'], pin: j['pin'] ?? '',
        email: j['email'], phone: j['phone']);
  Map<String, dynamic> toJson() => {
        'id': id, 'studentNo': studentNo, 'name': name, 'pin': pin,
        if (email != null && email!.isNotEmpty) 'email': email,
        if (phone != null && phone!.isNotEmpty) 'phone': phone,
      };
}

class Session {
  String id, date, topic;
  Map<String, String> records; // studentId -> P/A/L/E
  Session({required this.id, required this.date, this.topic = '', Map<String, String>? records}) : records = records ?? {};
  factory Session.fromJson(Map<String, dynamic> j) => Session(
        id: j['id'], date: j['date'], topic: j['topic'] ?? '',
        records: Map<String, String>.from((j['records'] ?? {}) as Map));
  Map<String, dynamic> toJson() => {'id': id, 'date': date, 'topic': topic, 'records': records};
}

class Assessment {
  String id, name, category;
  double max, weight;
  String? date;
  Assessment({required this.id, required this.name, required this.category, required this.max, required this.weight, this.date});
  factory Assessment.fromJson(Map<String, dynamic> j) => Assessment(
        id: j['id'], name: j['name'], category: j['category'] ?? '', max: _d(j['max']), weight: _d(j['weight']), date: j['date']);
  Map<String, dynamic> toJson() => {
        'id': id, 'name': name, 'category': category, 'max': max, 'weight': weight,
        if (date != null && date!.isNotEmpty) 'date': date,
      };
}

class Announcement {
  String id, title, body, date;
  bool pinned;
  Announcement({required this.id, required this.title, required this.body, required this.date, this.pinned = false});
  factory Announcement.fromJson(Map<String, dynamic> j) => Announcement(
        id: j['id'], title: j['title'], body: j['body'] ?? '', date: j['date'] ?? '', pinned: j['pinned'] == true);
  Map<String, dynamic> toJson() => {'id': id, 'title': title, 'body': body, 'date': date, 'pinned': pinned};
}

class GradeBand {
  double min;
  String letter;
  double points;
  GradeBand(this.min, this.letter, this.points);
  factory GradeBand.fromJson(Map<String, dynamic> j) => GradeBand(_d(j['min']), j['letter'], _d(j['points']));
  Map<String, dynamic> toJson() => {'min': min, 'letter': letter, 'points': points};
}

class Course {
  String id, code, title, section, semester, room, lecturer, time, startDate, createdAt;
  int credits, weeks, capacity;
  List<int> days; // 0 = Sunday
  double attendanceWeight, riskAttendance, riskStanding;
  List<GradeBand> scale;
  List<Student> students;
  List<Session> sessions;
  List<Assessment> assessments;
  Map<String, Map<String, double?>> scores; // assessmentId -> studentId -> score
  List<Announcement> announcements;

  Course({
    required this.id, this.code = '', this.title = '', this.section = '1', this.semester = '', this.room = '',
    this.lecturer = '', this.time = '09:00', required this.startDate, required this.createdAt,
    this.credits = 3, this.weeks = 15, this.capacity = 40, List<int>? days,
    this.attendanceWeight = 0, this.riskAttendance = 75, this.riskStanding = 60,
    required this.scale, List<Student>? students, List<Session>? sessions, List<Assessment>? assessments,
    Map<String, Map<String, double?>>? scores, List<Announcement>? announcements,
  })  : days = days ?? [1, 3, 5],
        students = students ?? [],
        sessions = sessions ?? [],
        assessments = assessments ?? [],
        scores = scores ?? {},
        announcements = announcements ?? [];

  factory Course.fromJson(Map<String, dynamic> j) {
    final rawScores = (j['scores'] ?? {}) as Map;
    return Course(
      id: j['id'], code: j['code'] ?? '', title: j['title'] ?? '', section: j['section'] ?? '1',
      semester: j['semester'] ?? '', room: j['room'] ?? '', lecturer: j['lecturer'] ?? '',
      time: j['time'] ?? '09:00', startDate: j['startDate'] ?? DateTime.now().toIso8601String().substring(0, 10),
      createdAt: j['createdAt'] ?? DateTime.now().toIso8601String(),
      credits: (j['credits'] ?? 3).toInt(), weeks: (j['weeks'] ?? 15).toInt(), capacity: (j['capacity'] ?? 40).toInt(),
      days: ((j['days'] ?? [1, 3, 5]) as List).map((e) => (e as num).toInt()).toList(),
      attendanceWeight: _d(j['attendanceWeight'] ?? 0), riskAttendance: _d(j['riskAttendance'] ?? 75),
      riskStanding: _d(j['riskStanding'] ?? 60),
      scale: j['scale'] == null
          ? defaultScale()
          : (j['scale'] as List).map((e) => GradeBand.fromJson(Map<String, dynamic>.from(e))).toList(),
      students: ((j['students'] ?? []) as List).map((e) => Student.fromJson(Map<String, dynamic>.from(e))).toList(),
      sessions: ((j['sessions'] ?? []) as List).map((e) => Session.fromJson(Map<String, dynamic>.from(e))).toList(),
      assessments: ((j['assessments'] ?? []) as List).map((e) => Assessment.fromJson(Map<String, dynamic>.from(e))).toList(),
      scores: rawScores.map((k, v) => MapEntry(
          k as String, (v as Map).map((sk, sv) => MapEntry(sk as String, sv == null ? null : (sv as num).toDouble())))),
      announcements: ((j['announcements'] ?? []) as List).map((e) => Announcement.fromJson(Map<String, dynamic>.from(e))).toList(),
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id, 'code': code, 'title': title, 'section': section, 'credits': credits, 'semester': semester,
        'room': room, 'lecturer': lecturer, 'days': days, 'time': time, 'startDate': startDate, 'weeks': weeks,
        'capacity': capacity, 'attendanceWeight': attendanceWeight, 'riskAttendance': riskAttendance,
        'riskStanding': riskStanding, 'scale': scale.map((e) => e.toJson()).toList(),
        'students': students.map((e) => e.toJson()).toList(), 'sessions': sessions.map((e) => e.toJson()).toList(),
        'assessments': assessments.map((e) => e.toJson()).toList(), 'scores': scores,
        'announcements': announcements.map((e) => e.toJson()).toList(), 'createdAt': createdAt,
      };
}

List<GradeBand> defaultScale() => [
      GradeBand(90, 'A', 4), GradeBand(80, 'B', 3), GradeBand(70, 'C', 2), GradeBand(60, 'D', 1), GradeBand(0, 'F', 0),
    ];

class Workspace {
  String lecturerName;
  List<Course> courses;
  Workspace({this.lecturerName = '', List<Course>? courses}) : courses = courses ?? [];
  factory Workspace.fromJson(Map<String, dynamic> j) => Workspace(
        lecturerName: j['lecturerName'] ?? '',
        courses: ((j['courses'] ?? []) as List).map((e) => Course.fromJson(Map<String, dynamic>.from(e))).toList(),
      );
  Map<String, dynamic> toJson() => {'version': 1, 'lecturerName': lecturerName, 'courses': courses.map((e) => e.toJson()).toList()};
}

// ---- Student-side models (decrypted share file) ----

class StudentView {
  final String name, studentNo, letter;
  final List<Map<String, dynamic>> attendance, assessments;
  final double? attendancePct, standing, projected;
  final int? rank;
  final int classSize;
  StudentView({
    required this.name, required this.studentNo, required this.letter, required this.attendance,
    required this.assessments, this.attendancePct, this.standing, this.projected, this.rank, required this.classSize,
  });
  factory StudentView.fromJson(Map<String, dynamic> j) => StudentView(
        name: j['name'], studentNo: j['studentNo'], letter: j['letter'] ?? '–',
        attendance: ((j['attendance'] ?? []) as List).map((e) => Map<String, dynamic>.from(e)).toList(),
        assessments: ((j['assessments'] ?? []) as List).map((e) => Map<String, dynamic>.from(e)).toList(),
        attendancePct: (j['attendancePct'] as num?)?.toDouble(), standing: (j['standing'] as num?)?.toDouble(),
        projected: (j['projected'] as num?)?.toDouble(), rank: (j['rank'] as num?)?.toInt(),
        classSize: (j['classSize'] ?? 0).toInt(),
      );
}
