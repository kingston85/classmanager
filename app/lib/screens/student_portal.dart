import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../logic.dart';
import '../models.dart';
import '../services/files.dart';
import '../services/share_service.dart';
import '../widgets.dart';

const _bundleKey = 'classmanager.student.bundle.v1';

class StudentPortal extends StatefulWidget {
  const StudentPortal({super.key});
  @override
  State<StudentPortal> createState() => _StudentPortalState();
}

class _StudentPortalState extends State<StudentPortal> {
  Map<String, dynamic>? bundle;
  StudentView? view;
  final no = TextEditingController(), pin = TextEditingController();
  String err = '';
  bool busy = false;

  @override
  void initState() {
    super.initState();
    _restore();
  }

  Future<void> _restore() async {
    final p = await SharedPreferences.getInstance();
    final raw = p.getString(_bundleKey);
    if (raw != null) {
      try {
        final b = jsonDecode(raw);
        if (isShareBundle(b)) bundle = Map<String, dynamic>.from(b as Map);
      } catch (_) {}
    }
    no.text = p.getString('$_bundleKey.no') ?? '';
    if (mounted) setState(() {});
  }

  Future<void> _load() async {
    final text = await pickTextFile();
    if (text == null) return;
    try {
      final b = jsonDecode(text);
      if (!isShareBundle(b)) throw 'bad';
      final p = await SharedPreferences.getInstance();
      await p.setString(_bundleKey, text);
      setState(() {
        bundle = Map<String, dynamic>.from(b as Map);
        view = null;
        err = '';
      });
    } catch (_) {
      setState(() => err = 'That file is not a ClassManager share file.');
    }
  }

  Future<void> _login() async {
    setState(() {
      busy = true;
      err = '';
    });
    final v = await openEntry(bundle!, no.text, pin.text);
    final p = await SharedPreferences.getInstance();
    if (v != null) await p.setString('$_bundleKey.no', no.text);
    if (!mounted) return;
    setState(() {
      busy = false;
      view = v;
      if (v == null) err = 'Student number or PIN not recognised for this class.';
      pin.clear();
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Student portal'), actions: [
        if (view != null) TextButton(onPressed: () => setState(() => view = null), child: const Text('Lock')),
      ]),
      body: PageBox(
        maxWidth: 800,
        child: ListView(padding: const EdgeInsets.all(16), children: [
          if (bundle == null) ...[
            const Text('Load the class file your lecturer sent you, then sign in with your student number and personal PIN. Everything stays on this device.'),
            const SizedBox(height: 12),
            FilledButton.icon(onPressed: _load, icon: const Icon(Icons.upload_file), label: const Text('Load class file')),
          ] else if (view == null) ...[
            Text('${bundle!['course']['code']} — ${bundle!['course']['title']}', style: Theme.of(context).textTheme.titleLarge),
            Text('Section ${bundle!['course']['section']} · ${bundle!['course']['lecturer']}'),
            const SizedBox(height: 16),
            TextField(controller: no, decoration: const InputDecoration(labelText: 'Student number', border: OutlineInputBorder())),
            const SizedBox(height: 12),
            TextField(
              controller: pin,
              obscureText: true,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(labelText: 'PIN', border: OutlineInputBorder()),
              onSubmitted: (_) => _login(),
            ),
            if (err.isNotEmpty) Padding(padding: const EdgeInsets.only(top: 8), child: Text(err, style: const TextStyle(color: Colors.red))),
            const SizedBox(height: 12),
            Wrap(spacing: 8, children: [
              FilledButton(onPressed: busy ? null : _login, child: Text(busy ? 'Opening…' : 'Open my record')),
              OutlinedButton(onPressed: _load, child: const Text('Load newer file')),
              TextButton(
                onPressed: () async {
                  (await SharedPreferences.getInstance()).remove(_bundleKey);
                  setState(() => bundle = null);
                },
                child: const Text('Remove class'),
              ),
            ]),
            _announcements(),
          ] else
            ..._record(context, view!),
          if (err.isNotEmpty && bundle == null) Text(err, style: const TextStyle(color: Colors.red)),
        ]),
      ),
    );
  }

  Widget _announcements() {
    final list = (bundle?['announcements'] as List?) ?? [];
    if (list.isEmpty) return const SizedBox.shrink();
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      const SizedBox(height: 20),
      Text('Announcements', style: Theme.of(context).textTheme.titleMedium),
      for (final a in list)
        Card(
          child: ListTile(
            title: Text('${a['pinned'] == true ? '📌 ' : ''}${a['title']}'),
            subtitle: Text('${a['date']}\n${a['body']}'),
            isThreeLine: true,
          ),
        ),
    ]);
  }

  List<Widget> _record(BuildContext context, StudentView v) {
    String pct(double? x) => x == null ? '–' : '${round1(x)}%';
    return [
      Text('${v.name}  #${v.studentNo}', style: Theme.of(context).textTheme.titleLarge),
      Text('${bundle!['course']['code']} — ${bundle!['course']['title']}'),
      const SizedBox(height: 8),
      Wrap(spacing: 8, runSpacing: 8, children: [
        SizedBox(width: 180, child: StatCard(pct(v.standing), 'Standing (${v.letter})')),
        SizedBox(width: 180, child: StatCard(pct(v.projected), 'Of total course so far')),
        SizedBox(width: 180, child: StatCard(pct(v.attendancePct), 'Attendance')),
        SizedBox(width: 180, child: StatCard(v.rank == null ? '–' : '${v.rank}/${v.classSize}', 'Class rank')),
      ]),
      const SizedBox(height: 16),
      Text('Assessments', style: Theme.of(context).textTheme.titleMedium),
      SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: DataTable(
          columns: const [DataColumn(label: Text('Assessment')), DataColumn(label: Text('Weight')), DataColumn(label: Text('Score')), DataColumn(label: Text('%'))],
          rows: [
            for (final a in v.assessments)
              DataRow(cells: [
                DataCell(Text('${a['name']}')),
                DataCell(Text('${a['weight']}%')),
                DataCell(Text(a['score'] == null ? 'not graded' : '${a['score']} / ${a['max']}')),
                DataCell(Text(a['score'] == null ? '' : '${round1((a['score'] as num) / (a['max'] as num) * 100)}%')),
              ]),
          ],
        ),
      ),
      const SizedBox(height: 16),
      Text('Attendance record', style: Theme.of(context).textTheme.titleMedium),
      for (final a in v.attendance)
        ListTile(
          dense: true,
          title: Text('${a['date']}  ${a['topic']}'),
          trailing: _statusPill('${a['status']}'),
        ),
      _announcements(),
    ];
  }

  Widget _statusPill(String s) {
    switch (s) {
      case 'P': return const Pill('Present', Colors.green);
      case 'A': return const Pill('Absent', Colors.red);
      case 'L': return const Pill('Late', Colors.orange);
      case 'E': return const Pill('Excused', Colors.blue);
      default: return const Text('—');
    }
  }
}
