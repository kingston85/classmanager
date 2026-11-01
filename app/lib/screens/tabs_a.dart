import 'package:flutter/material.dart';
import '../logic.dart';
import '../main.dart';
import '../models.dart';
import '../widgets.dart';

class OverviewTab extends StatelessWidget {
  final Course c;
  const OverviewTab(this.c, {super.key});

  @override
  Widget build(BuildContext context) {
    final results = classResults(c);
    final standings = results.map((r) => r.standing).whereType<double>().toList();
    final avg = standings.isEmpty ? null : standings.reduce((a, b) => a + b) / standings.length;
    final att = c.students.map((s) => attendanceStats(c, s.id).pct).whereType<double>().toList();
    final attAvg = att.isEmpty ? null : att.reduce((a, b) => a + b) / att.length;
    final totalWeight = c.assessments.fold<double>(0, (t, a) => t + a.weight) + c.attendanceWeight;
    String p(double? v) => v == null ? '–' : '${round1(v)}%';
    return PageBox(
      child: ListView(padding: const EdgeInsets.all(16), children: [
        if (c.students.isEmpty)
          const Card(child: Padding(padding: EdgeInsets.all(12), child: Text('Start in the Roster tab, then set the schedule in Settings and generate sessions.'))),
        if (c.assessments.isNotEmpty && (totalWeight - 100).abs() > 0.01)
          Card(child: Padding(padding: const EdgeInsets.all(12), child: Text('Assessment weights add up to ${round1(totalWeight, 2)}%, not 100%. Standings are still scaled to the graded work; check your syllabus.'))),
        Wrap(spacing: 8, runSpacing: 8, children: [
          SizedBox(width: 200, child: StatCard('${c.students.length} / ${c.capacity}', 'Enrolled')),
          SizedBox(width: 200, child: StatCard(p(avg), 'Average standing')),
          SizedBox(width: 200, child: StatCard(p(attAvg), 'Average attendance')),
          SizedBox(width: 200, child: StatCard('${atRisk(c).length}', 'Students at risk')),
        ]),
        const SizedBox(height: 16),
        Text('Grade distribution', style: Theme.of(context).textTheme.titleMedium),
        if (standings.isEmpty) const Text('No scores entered yet.'),
        for (final b in c.scale)
          Builder(builder: (_) {
            final n = results.where((r) => r.letter == b.letter).length;
            return Padding(
              padding: const EdgeInsets.symmetric(vertical: 3),
              child: Row(children: [
                SizedBox(width: 28, child: Text(b.letter, style: const TextStyle(fontWeight: FontWeight.bold))),
                Expanded(child: LinearProgressIndicator(value: results.isEmpty ? 0 : n / results.length, minHeight: 14)),
                SizedBox(width: 32, child: Text('$n', textAlign: TextAlign.right)),
              ]),
            );
          }),
      ]),
    );
  }
}

class RosterTab extends StatefulWidget {
  final Course c;
  const RosterTab(this.c, {super.key});
  @override
  State<RosterTab> createState() => _RosterTabState();
}

class _RosterTabState extends State<RosterTab> {
  final paste = TextEditingController();
  final no = TextEditingController(), name = TextEditingController(), email = TextEditingController();
  String q = '';

  Course get c => widget.c;

  void _addMany(List<RosterRow> rows) {
    var added = 0, skipped = 0;
    store.mutate(() {
      for (final r in rows) {
        if (c.students.any((s) => s.studentNo.toLowerCase() == r.studentNo.toLowerCase())) {
          skipped++;
          continue;
        }
        c.students.add(Student(id: uid(), studentNo: r.studentNo, name: r.name, email: r.email, phone: r.phone, pin: genPin()));
        added++;
      }
      c.students.sort((a, b) => a.name.compareTo(b.name));
    });
    toast(context, 'Added $added${skipped > 0 ? ', skipped $skipped duplicate(s)' : ''}');
  }

  @override
  Widget build(BuildContext context) {
    final shown = c.students.where((s) => '${s.name}${s.studentNo}'.toLowerCase().contains(q.toLowerCase())).toList();
    return PageBox(
      child: ListView(padding: const EdgeInsets.all(16), children: [
        Card(
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('Add a student', style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: 8),
              Wrap(spacing: 8, runSpacing: 8, crossAxisAlignment: WrapCrossAlignment.center, children: [
                SizedBox(width: 140, child: TextField(controller: no, decoration: const InputDecoration(labelText: 'Student no.', isDense: true, border: OutlineInputBorder()))),
                SizedBox(width: 220, child: TextField(controller: name, decoration: const InputDecoration(labelText: 'Full name', isDense: true, border: OutlineInputBorder()))),
                SizedBox(width: 220, child: TextField(controller: email, decoration: const InputDecoration(labelText: 'Email (optional)', isDense: true, border: OutlineInputBorder()))),
                FilledButton(
                  onPressed: () {
                    if (no.text.trim().isEmpty || name.text.trim().isEmpty) return;
                    _addMany([RosterRow(no.text.trim(), name.text.trim(), email.text.trim().isEmpty ? null : email.text.trim(), null)]);
                    no.clear();
                    name.clear();
                    email.clear();
                  },
                  child: const Text('Add'),
                ),
              ]),
              const Divider(height: 28),
              Text('Paste a roster', style: Theme.of(context).textTheme.titleMedium),
              const Text('One student per line: student no, name, email, phone (commas or tabs).'),
              const SizedBox(height: 8),
              TextField(controller: paste, minLines: 3, maxLines: 6, decoration: const InputDecoration(border: OutlineInputBorder(), hintText: '1001, Ama Doe, ama@example.com')),
              const SizedBox(height: 8),
              FilledButton(
                onPressed: () {
                  if (paste.text.trim().isEmpty) return;
                  _addMany(parseRoster(paste.text));
                  paste.clear();
                },
                child: const Text('Import'),
              ),
            ]),
          ),
        ),
        const SizedBox(height: 8),
        Row(children: [
          Expanded(child: Text('Students (${c.students.length})', style: Theme.of(context).textTheme.titleMedium)),
          SizedBox(width: 200, child: TextField(onChanged: (v) => setState(() => q = v), decoration: const InputDecoration(hintText: 'Search…', isDense: true, prefixIcon: Icon(Icons.search), border: OutlineInputBorder()))),
          TextButton(
            onPressed: () async {
              if (await confirm(context, 'Generate new PINs for every student? Share files already sent will stop opening.', action: 'Reset')) {
                store.mutate(() {
                  for (final s in c.students) {
                    s.pin = genPin();
                  }
                });
              }
            },
            child: const Text('Reset PINs'),
          ),
        ]),
        for (var i = 0; i < shown.length; i++)
          Card(
            child: ExpansionTile(
              title: Text(shown[i].name),
              subtitle: Text('${shown[i].studentNo} · PIN ${shown[i].pin}'),
              childrenPadding: const EdgeInsets.all(12),
              children: [
                Wrap(spacing: 8, runSpacing: 8, children: [
                  CommitField(label: 'Student no.', width: 150, value: shown[i].studentNo, onCommit: (v) { if (v.trim().isNotEmpty) store.mutate(() => shown[i].studentNo = v.trim()); }),
                  CommitField(label: 'Name', width: 240, value: shown[i].name, onCommit: (v) { if (v.trim().isNotEmpty) store.mutate(() => shown[i].name = v.trim()); }),
                  CommitField(label: 'Email', width: 240, value: shown[i].email ?? '', onCommit: (v) => store.mutate(() => shown[i].email = v.trim())),
                  CommitField(label: 'Phone', width: 170, value: shown[i].phone ?? '', onCommit: (v) => store.mutate(() => shown[i].phone = v.trim())),
                  TextButton.icon(
                    icon: const Icon(Icons.delete_outline, color: Colors.red),
                    label: const Text('Remove', style: TextStyle(color: Colors.red)),
                    onPressed: () async {
                      final s = shown[i];
                      if (await confirm(context, 'Remove ${s.name}? Their attendance and scores for this course will be deleted.', action: 'Remove')) {
                        store.mutate(() {
                          c.students.removeWhere((x) => x.id == s.id);
                          for (final sess in c.sessions) {
                            sess.records.remove(s.id);
                          }
                          for (final row in c.scores.values) {
                            row.remove(s.id);
                          }
                        });
                      }
                    },
                  ),
                ]),
              ],
            ),
          ),
      ]),
    );
  }
}

class AttendanceTab extends StatefulWidget {
  final Course c;
  const AttendanceTab(this.c, {super.key});
  @override
  State<AttendanceTab> createState() => _AttendanceTabState();
}

class _AttendanceTabState extends State<AttendanceTab> {
  String? sel;
  bool summary = false;
  Course get c => widget.c;

  List<Session> get sorted => [...c.sessions]..sort((a, b) => a.date.compareTo(b.date));

  Session? get current {
    final list = sorted;
    if (list.isEmpty) return null;
    final found = list.where((s) => s.id == sel);
    if (found.isNotEmpty) return found.first;
    final today = todayIso();
    return list.firstWhere((s) => s.date.compareTo(today) >= 0, orElse: () => list.last);
  }

  void _generate() {
    final have = c.sessions.map((s) => s.date).toSet();
    store.mutate(() => c.sessions.addAll(generateSessions(c).where((s) => !have.contains(s.date))));
  }

  Future<void> _addSession() async {
    final d = await showDatePicker(context: context, initialDate: DateTime.now(), firstDate: DateTime(2020), lastDate: DateTime(2100));
    if (d == null || !mounted) return;
    final iso = toIso(d);
    if (c.sessions.any((s) => s.date == iso)) {
      toast(context, 'A session already exists on that date.');
      return;
    }
    final s = Session(id: uid(), date: iso);
    store.mutate(() => c.sessions.add(s));
    setState(() => sel = s.id);
  }

  @override
  Widget build(BuildContext context) {
    if (c.students.isEmpty) return const Center(child: Text('Add students in the Roster tab first.'));
    final cur = current;
    return PageBox(
      child: Column(children: [
        Padding(
          padding: const EdgeInsets.all(12),
          child: Wrap(spacing: 8, runSpacing: 8, crossAxisAlignment: WrapCrossAlignment.center, children: [
            SegmentedButton<bool>(
              segments: const [ButtonSegment(value: false, label: Text('Mark')), ButtonSegment(value: true, label: Text('Summary'))],
              selected: {summary},
              onSelectionChanged: (v) => setState(() => summary = v.first),
            ),
            OutlinedButton(onPressed: _generate, child: const Text('Generate from schedule')),
            OutlinedButton(onPressed: _addSession, child: const Text('+ Session')),
          ]),
        ),
        Expanded(child: summary ? _summary(context) : _mark(context, cur)),
      ]),
    );
  }

  Widget _summary(BuildContext context) => ListView(children: [
        for (final s in c.students)
          Builder(builder: (_) {
            final a = attendanceStats(c, s.id);
            final low = a.pct != null && a.pct! < c.riskAttendance;
            return ListTile(
              dense: true,
              title: Text(s.name),
              subtitle: Text('P ${a.present} · L ${a.late} · A ${a.absent} · E ${a.excused}'),
              trailing: Pill(a.pct == null ? '–' : '${round1(a.pct!)}%', a.pct == null ? Colors.grey : (low ? Colors.red : Colors.green)),
            );
          }),
      ]);

  Widget _mark(BuildContext context, Session? cur) {
    if (cur == null) {
      return Center(child: FilledButton(onPressed: _generate, child: const Text('Generate sessions from the schedule')));
    }
    final list = sorted;
    return Column(children: [
      SizedBox(
        height: 52,
        child: ListView(scrollDirection: Axis.horizontal, padding: const EdgeInsets.symmetric(horizontal: 12), children: [
          for (final s in list)
            Padding(
              padding: const EdgeInsets.only(right: 6),
              child: ChoiceChip(
                label: Text(s.date.substring(5)),
                selected: s.id == cur.id,
                onSelected: (_) => setState(() => sel = s.id),
              ),
            ),
        ]),
      ),
      Padding(
        padding: const EdgeInsets.symmetric(horizontal: 12),
        child: Row(children: [
          Expanded(
            child: CommitField(key: ValueKey(cur.id), label: 'Topic for ${cur.date}', value: cur.topic, onCommit: (v) => store.mutate(() => cur.topic = v)),
          ),
          const SizedBox(width: 8),
          OutlinedButton(
            onPressed: () => store.mutate(() {
              for (final s in c.students) {
                cur.records[s.id] = 'P';
              }
            }),
            child: const Text('All present'),
          ),
          IconButton(
            tooltip: 'Delete session',
            icon: const Icon(Icons.delete_outline),
            onPressed: () async {
              if (await confirm(context, 'Delete the ${cur.date} session and its attendance marks?')) {
                store.mutate(() => c.sessions.removeWhere((s) => s.id == cur.id));
                setState(() => sel = null);
              }
            },
          ),
        ]),
      ),
      const Padding(padding: EdgeInsets.all(8), child: Text('P present · L late (half) · A absent · E excused (not counted)', style: TextStyle(fontSize: 12))),
      Expanded(
        child: ListView(children: [
          for (final s in c.students)
            ListTile(
              dense: true,
              title: Text(s.name),
              subtitle: Text(s.studentNo),
              trailing: SegmentedButton<String>(
                showSelectedIcon: false,
                emptySelectionAllowed: true,
                segments: const [
                  ButtonSegment(value: 'P', label: Text('P')),
                  ButtonSegment(value: 'L', label: Text('L')),
                  ButtonSegment(value: 'A', label: Text('A')),
                  ButtonSegment(value: 'E', label: Text('E')),
                ],
                selected: {if (cur.records[s.id] != null) cur.records[s.id]!},
                onSelectionChanged: (v) => store.mutate(() {
                  if (v.isEmpty) {
                    cur.records.remove(s.id);
                  } else {
                    cur.records[s.id] = v.first;
                  }
                }),
              ),
            ),
        ]),
      ),
    ]);
  }
}
