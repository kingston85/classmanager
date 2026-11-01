import 'package:flutter/material.dart';
import '../logic.dart';
import '../main.dart';
import '../models.dart';
import '../widgets.dart';

class GradebookTab extends StatefulWidget {
  final Course c;
  const GradebookTab(this.c, {super.key});
  @override
  State<GradebookTab> createState() => _GradebookTabState();
}

class _GradebookTabState extends State<GradebookTab> {
  final name = TextEditingController(), category = TextEditingController(text: 'Assignment');
  final max = TextEditingController(text: '100'), weight = TextEditingController(text: '10');
  Course get c => widget.c;

  void _add() {
    final m = double.tryParse(max.text), w = double.tryParse(weight.text);
    if (name.text.trim().isEmpty || m == null || m <= 0 || w == null || w < 0) {
      toast(context, 'Enter a name, a maximum above 0 and a weight of 0 or more.');
      return;
    }
    store.mutate(() => c.assessments.add(Assessment(id: uid(), name: name.text.trim(), category: category.text.trim(), max: m, weight: w)));
    name.clear();
  }

  @override
  Widget build(BuildContext context) {
    final results = classResults(c);
    final byId = {for (final r in results) r.studentId: r};
    final total = c.assessments.fold<double>(0, (t, a) => t + a.weight) + c.attendanceWeight;
    return PageBox(
      maxWidth: 1300,
      child: ListView(padding: const EdgeInsets.all(16), children: [
        Text('Assessments', style: Theme.of(context).textTheme.titleMedium),
        Text('Total weight incl. ${c.attendanceWeight.round()}% attendance: ${round1(total, 2)}%',
            style: TextStyle(color: (total - 100).abs() < 0.01 ? null : Colors.red)),
        const SizedBox(height: 8),
        for (final a in c.assessments)
          Card(
            child: Padding(
              padding: const EdgeInsets.all(10),
              child: Wrap(spacing: 8, runSpacing: 8, crossAxisAlignment: WrapCrossAlignment.center, children: [
                CommitField(label: 'Name', width: 200, value: a.name, onCommit: (v) { if (v.trim().isNotEmpty) store.mutate(() => a.name = v.trim()); }),
                CommitField(label: 'Type', width: 140, value: a.category, onCommit: (v) => store.mutate(() => a.category = v.trim())),
                CommitField(label: 'Max', width: 80, keyboard: TextInputType.number, value: '${a.max}'.replaceAll(RegExp(r'\.0$'), ''), onCommit: (v) {
                  final n = double.tryParse(v);
                  if (n != null && n > 0) store.mutate(() => a.max = n);
                }),
                CommitField(label: 'Weight %', width: 90, keyboard: TextInputType.number, value: '${a.weight}'.replaceAll(RegExp(r'\.0$'), ''), onCommit: (v) {
                  final n = double.tryParse(v);
                  if (n != null && n >= 0) store.mutate(() => a.weight = n);
                }),
                IconButton(
                  icon: const Icon(Icons.delete_outline, color: Colors.red),
                  onPressed: () async {
                    if (await confirm(context, 'Delete "${a.name}" and all of its scores?')) {
                      store.mutate(() {
                        c.assessments.removeWhere((x) => x.id == a.id);
                        c.scores.remove(a.id);
                      });
                    }
                  },
                ),
              ]),
            ),
          ),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(10),
            child: Wrap(spacing: 8, runSpacing: 8, crossAxisAlignment: WrapCrossAlignment.center, children: [
              SizedBox(width: 200, child: TextField(controller: name, decoration: const InputDecoration(labelText: 'New assessment', isDense: true, border: OutlineInputBorder()))),
              SizedBox(width: 140, child: TextField(controller: category, decoration: const InputDecoration(labelText: 'Type', isDense: true, border: OutlineInputBorder()))),
              SizedBox(width: 80, child: TextField(controller: max, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Max', isDense: true, border: OutlineInputBorder()))),
              SizedBox(width: 90, child: TextField(controller: weight, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Weight %', isDense: true, border: OutlineInputBorder()))),
              FilledButton(onPressed: _add, child: const Text('Add')),
            ]),
          ),
        ),
        const SizedBox(height: 16),
        Text('Scores', style: Theme.of(context).textTheme.titleMedium),
        const Text('Leave a cell empty if not graded yet (it is skipped). Enter 0 for an actual zero.'),
        const SizedBox(height: 8),
        if (c.students.isEmpty || c.assessments.isEmpty)
          const Padding(padding: EdgeInsets.all(24), child: Center(child: Text('Add students and at least one assessment to enter scores.')))
        else
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: DataTable(
              columnSpacing: 14,
              columns: [
                const DataColumn(label: Text('Student')),
                for (final a in c.assessments) DataColumn(label: Text('${a.name}\n/${a.max.toString().replaceAll(RegExp(r'\.0$'), '')}')),
                const DataColumn(label: Text('Attend.')),
                const DataColumn(label: Text('Standing')),
                const DataColumn(label: Text('Grade')),
                const DataColumn(label: Text('Rank')),
              ],
              rows: [
                for (final s in c.students)
                  DataRow(cells: [
                    DataCell(SizedBox(width: 170, child: Text(s.name, overflow: TextOverflow.ellipsis))),
                    for (final a in c.assessments)
                      DataCell(CommitField(
                        key: ValueKey('${a.id}-${s.id}'),
                        width: 76,
                        alignRight: true,
                        keyboard: const TextInputType.numberWithOptions(decimal: true),
                        value: _fmt(c.scores[a.id]?[s.id]),
                        onCommit: (v) {
                          final t = v.trim();
                          final cur = c.scores[a.id]?[s.id];
                          if (t == _fmt(cur)) return;
                          store.mutate(() {
                            c.scores.putIfAbsent(a.id, () => {});
                            if (t.isEmpty) {
                              c.scores[a.id]![s.id] = null;
                            } else {
                              final n = double.tryParse(t);
                              if (n != null && n >= 0) c.scores[a.id]![s.id] = n > a.max * 2 ? a.max * 2 : n;
                            }
                          });
                        },
                      )),
                    DataCell(Text(byId[s.id]!.attendancePct == null ? '–' : '${round1(byId[s.id]!.attendancePct!, 0).toInt()}%')),
                    DataCell(Text(byId[s.id]!.standing == null ? '–' : '${round1(byId[s.id]!.standing!)}%', style: const TextStyle(fontWeight: FontWeight.bold))),
                    DataCell(Text(byId[s.id]!.letter)),
                    DataCell(Text('${byId[s.id]!.rank ?? '–'}')),
                  ]),
              ],
            ),
          ),
      ]),
    );
  }

  String _fmt(double? v) => v == null ? '' : v.toString().replaceAll(RegExp(r'\.0$'), '');
}

class AnalysisTab extends StatelessWidget {
  final Course c;
  const AnalysisTab(this.c, {super.key});

  @override
  Widget build(BuildContext context) {
    final rows = <MapEntry<Assessment, AssessmentStats>>[];
    for (final a in c.assessments) {
      final s = assessmentStats(c, a);
      if (s != null) rows.add(MapEntry(a, s));
    }
    if (rows.isEmpty) return const Center(child: Text('Enter scores in the Gradebook to see item analysis.'));
    return PageBox(
      child: ListView(padding: const EdgeInsets.all(16), children: [
        for (final e in rows)
          Card(
            child: Padding(
              padding: const EdgeInsets.all(14),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('${e.key.name}  (/${e.key.max.toString().replaceAll(RegExp(r'\.0$'), '')}, ${e.key.weight.toString().replaceAll(RegExp(r'\.0$'), '')}%)', style: Theme.of(context).textTheme.titleMedium),
                const SizedBox(height: 6),
                Wrap(spacing: 18, children: [
                  Text('Mean ${round1(e.value.mean / e.key.max * 100)}%'),
                  Text('Median ${round1(e.value.median)}'),
                  Text('High ${e.value.high} / Low ${e.value.low}'),
                  Text('≥60%: ${round1(e.value.passRate, 0).toInt()}%'),
                  Text('SD ${round1(e.value.sd, 2)}'),
                  Text('${e.value.n} of ${c.students.length} graded'),
                ]),
                const SizedBox(height: 12),
                SizedBox(
                  height: 100,
                  child: Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
                    for (var i = 0; i < 10; i++)
                      Expanded(
                        child: Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 2),
                          child: Column(mainAxisAlignment: MainAxisAlignment.end, children: [
                            if (e.value.histogram[i] > 0) Text('${e.value.histogram[i]}', style: const TextStyle(fontSize: 11)),
                            Container(
                              height: 4 + 70.0 * e.value.histogram[i] / (e.value.histogram.reduce((a, b) => a > b ? a : b)),
                              decoration: BoxDecoration(color: Theme.of(context).colorScheme.primary, borderRadius: BorderRadius.circular(3)),
                            ),
                            Text('${i * 10}', style: const TextStyle(fontSize: 10)),
                          ]),
                        ),
                      ),
                  ]),
                ),
              ]),
            ),
          ),
      ]),
    );
  }
}

class RiskTab extends StatelessWidget {
  final Course c;
  const RiskTab(this.c, {super.key});

  @override
  Widget build(BuildContext context) {
    final list = atRisk(c);
    return PageBox(
      child: ListView(padding: const EdgeInsets.all(16), children: [
        Text('Flagged when attendance < ${c.riskAttendance.round()}%, standing < ${c.riskStanding.round()}%, or a graded assessment has no score. Change thresholds in Settings.'),
        const SizedBox(height: 8),
        if (list.isEmpty) const Padding(padding: EdgeInsets.all(32), child: Center(child: Text('Nobody is flagged right now.'))),
        for (final r in list)
          Card(
            child: ListTile(
              title: Text('${r.student.name}  (${r.student.studentNo})'),
              subtitle: Text(r.reasons.map((x) => '• $x').join('\n') +
                  ((r.student.email ?? '').isNotEmpty || (r.student.phone ?? '').isNotEmpty
                      ? '\n${[r.student.email, r.student.phone].where((x) => x != null && x.isNotEmpty).join(' · ')}'
                      : '')),
              isThreeLine: true,
              trailing: Pill(r.standing == null ? '–' : '${round1(r.standing!, 0).toInt()}%', Colors.red),
            ),
          ),
      ]),
    );
  }
}
