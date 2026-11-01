import 'dart:convert';
import 'package:flutter/material.dart';
import '../logic.dart';
import '../main.dart';
import '../models.dart';
import '../services/files.dart';
import '../services/share_service.dart';
import '../widgets.dart';

class AnnouncementsTab extends StatefulWidget {
  final Course c;
  const AnnouncementsTab(this.c, {super.key});
  @override
  State<AnnouncementsTab> createState() => _AnnouncementsTabState();
}

class _AnnouncementsTabState extends State<AnnouncementsTab> {
  final title = TextEditingController(), body = TextEditingController();
  bool pinned = false;
  Course get c => widget.c;

  @override
  Widget build(BuildContext context) {
    final list = [...c.announcements]..sort((a, b) {
        final p = (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0);
        return p != 0 ? p : b.date.compareTo(a.date);
      });
    return PageBox(
      child: ListView(padding: const EdgeInsets.all(16), children: [
        Card(
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('New announcement', style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: 8),
              TextField(controller: title, decoration: const InputDecoration(labelText: 'Title', border: OutlineInputBorder())),
              const SizedBox(height: 8),
              TextField(controller: body, minLines: 3, maxLines: 6, decoration: const InputDecoration(labelText: 'Message', border: OutlineInputBorder())),
              CheckboxListTile(contentPadding: EdgeInsets.zero, value: pinned, onChanged: (v) => setState(() => pinned = v ?? false), title: const Text('Pin to the top')),
              FilledButton(
                onPressed: () {
                  if (title.text.trim().isEmpty) return;
                  store.mutate(() => c.announcements.add(Announcement(id: uid(), title: title.text.trim(), body: body.text.trim(), date: todayIso(), pinned: pinned)));
                  title.clear();
                  body.clear();
                  setState(() => pinned = false);
                },
                child: const Text('Post'),
              ),
              const SizedBox(height: 4),
              const Text('Students see announcements in the next share file you send them.', style: TextStyle(fontSize: 12)),
            ]),
          ),
        ),
        for (final a in list)
          Card(
            child: ListTile(
              title: Text('${a.pinned ? '📌 ' : ''}${a.title}'),
              subtitle: Text('${a.date}\n${a.body}'),
              isThreeLine: true,
              trailing: Wrap(children: [
                IconButton(icon: Icon(a.pinned ? Icons.push_pin : Icons.push_pin_outlined), onPressed: () => store.mutate(() => a.pinned = !a.pinned)),
                IconButton(icon: const Icon(Icons.delete_outline), onPressed: () => store.mutate(() => c.announcements.removeWhere((x) => x.id == a.id))),
              ]),
            ),
          ),
      ]),
    );
  }
}

class ShareTab extends StatefulWidget {
  final Course c;
  const ShareTab(this.c, {super.key});
  @override
  State<ShareTab> createState() => _ShareTabState();
}

class _ShareTabState extends State<ShareTab> {
  bool busy = false;
  Course get c => widget.c;

  Future<void> _publish() async {
    setState(() => busy = true);
    try {
      final bundle = await buildShareBundle(c);
      final name = '${c.code.replaceAll(RegExp(r'\s+'), '')}-S${c.section}-share-${todayIso()}.json';
      if (mounted) await saveFile(context, name, utf8.encode(jsonEncode(bundle)));
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return PageBox(
      child: ListView(padding: const EdgeInsets.all(16), children: [
        Card(
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('Student share file', style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: 8),
              const Text('1. Give each student their PIN privately (listed below).\n'
                  '2. Save the share file and send it to the class (WhatsApp, email, shared drive). It is safe to circulate: every student’s record is encrypted with their own PIN, so nobody can read anyone else’s grades.\n'
                  '3. Students open Student in this app (or the web app), load the file, and sign in with their student number and PIN.\n\n'
                  'The file is a snapshot. Send a new one after entering attendance or scores.'),
              const SizedBox(height: 12),
              FilledButton.icon(
                onPressed: busy || c.students.isEmpty ? null : _publish,
                icon: const Icon(Icons.lock_outline),
                label: Text(busy ? 'Encrypting…' : 'Save share file'),
              ),
            ]),
          ),
        ),
        Text('Student PINs', style: Theme.of(context).textTheme.titleMedium),
        for (final s in c.students)
          ListTile(
            dense: true,
            title: Text(s.name),
            subtitle: Text('No. ${s.studentNo}'),
            trailing: SelectableText(s.pin, style: const TextStyle(fontFamily: 'monospace', fontWeight: FontWeight.bold, letterSpacing: 1.5)),
          ),
      ]),
    );
  }
}

class CourseSettingsTab extends StatelessWidget {
  final Course c;
  const CourseSettingsTab(this.c, {super.key});

  Widget _num(String label, double value, void Function(double) set, {double width = 150}) => CommitField(
        label: label,
        width: width,
        keyboard: TextInputType.number,
        value: value.toString().replaceAll(RegExp(r'\.0$'), ''),
        onCommit: (v) {
          final n = double.tryParse(v);
          if (n != null && n >= 0) store.mutate(() => set(n));
        },
      );

  @override
  Widget build(BuildContext context) {
    return PageBox(
      child: ListView(padding: const EdgeInsets.all(16), children: [
        Text('Course details', style: Theme.of(context).textTheme.titleMedium),
        const SizedBox(height: 8),
        Wrap(spacing: 8, runSpacing: 10, children: [
          CommitField(label: 'Code', width: 150, value: c.code, onCommit: (v) => store.mutate(() => c.code = v.trim())),
          CommitField(label: 'Title', width: 280, value: c.title, onCommit: (v) => store.mutate(() => c.title = v.trim())),
          CommitField(label: 'Section', width: 90, value: c.section, onCommit: (v) => store.mutate(() => c.section = v.trim())),
          CommitField(label: 'Semester', width: 220, value: c.semester, onCommit: (v) => store.mutate(() => c.semester = v.trim())),
          CommitField(label: 'Room', width: 140, value: c.room, onCommit: (v) => store.mutate(() => c.room = v.trim())),
          CommitField(label: 'Lecturer', width: 220, value: c.lecturer, onCommit: (v) => store.mutate(() => c.lecturer = v.trim())),
          _num('Credit hours', c.credits.toDouble(), (n) => c.credits = n.round(), width: 120),
          _num('Section cap', c.capacity.toDouble(), (n) => c.capacity = n.round(), width: 120),
        ]),
        const Divider(height: 32),
        Text('Schedule', style: Theme.of(context).textTheme.titleMedium),
        Wrap(spacing: 6, children: [
          for (var i = 0; i < 7; i++)
            FilterChip(
              label: Text(dayNames[i]),
              selected: c.days.contains(i),
              onSelected: (on) => store.mutate(() {
                if (on) {
                  c.days = ([...c.days, i]..sort());
                } else {
                  c.days = c.days.where((d) => d != i).toList();
                }
              }),
            ),
        ]),
        const SizedBox(height: 10),
        Wrap(spacing: 8, runSpacing: 10, children: [
          CommitField(label: 'Class time (HH:MM)', width: 150, value: c.time, onCommit: (v) => store.mutate(() => c.time = v.trim())),
          CommitField(label: 'First class (YYYY-MM-DD)', width: 200, value: c.startDate, onCommit: (v) {
            if (DateTime.tryParse(v.trim()) != null) store.mutate(() => c.startDate = v.trim());
          }),
          _num('Teaching weeks', c.weeks.toDouble(), (n) => c.weeks = n.round(), width: 150),
          OutlinedButton(
            onPressed: () async {
              if (!await confirm(context, 'Replace all UNMARKED sessions with a fresh schedule? Sessions that already have attendance are kept.', action: 'Regenerate')) return;
              store.mutate(() {
                final kept = c.sessions.where((s) => s.records.isNotEmpty).toList();
                final dates = kept.map((s) => s.date).toSet();
                c.sessions = [...kept, ...generateSessions(c).where((s) => !dates.contains(s.date))];
              });
            },
            child: Text('Regenerate sessions (${c.sessions.length})'),
          ),
        ]),
        const Divider(height: 32),
        Text('Grading and alerts', style: Theme.of(context).textTheme.titleMedium),
        const SizedBox(height: 8),
        Wrap(spacing: 8, runSpacing: 10, children: [
          _num('Attendance % of grade (0 = off)', c.attendanceWeight, (n) => c.attendanceWeight = n, width: 230),
          _num('Flag attendance below %', c.riskAttendance, (n) => c.riskAttendance = n, width: 190),
          _num('Flag standing below %', c.riskStanding, (n) => c.riskStanding = n, width: 190),
        ]),
        const SizedBox(height: 12),
        Text('Grade scale', style: Theme.of(context).textTheme.titleSmall),
        for (var i = 0; i < c.scale.length; i++)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 4),
            child: Wrap(spacing: 8, children: [
              _num('Min %', c.scale[i].min, (n) => c.scale[i].min = n, width: 90),
              CommitField(label: 'Letter', width: 80, value: c.scale[i].letter, onCommit: (v) { if (v.trim().isNotEmpty) store.mutate(() => c.scale[i].letter = v.trim()); }),
              _num('Points', c.scale[i].points, (n) => c.scale[i].points = n, width: 90),
            ]),
          ),
        TextButton(onPressed: () => store.mutate(() => c.scale = defaultScale()), child: const Text('Reset to A/B/C/D/F (90/80/70/60)')),
        const Divider(height: 32),
        FilledButton.tonal(
          style: FilledButton.styleFrom(foregroundColor: Colors.red),
          onPressed: () async {
            if (await confirm(context, 'Delete ${c.code} and all of its students, attendance and scores? This cannot be undone.')) {
              if (context.mounted) Navigator.pop(context);
              store.mutate(() => store.ws.courses.removeWhere((x) => x.id == c.id));
            }
          },
          child: const Text('Delete this course'),
        ),
      ]),
    );
  }
}
