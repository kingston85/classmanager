import 'dart:convert';
import 'package:flutter/material.dart';
import '../logic.dart';
import '../main.dart';
import '../models.dart';
import '../services/files.dart';
import '../widgets.dart';
import 'course_screen.dart';
import 'student_portal.dart';

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: store,
      builder: (context, _) {
        final courses = store.ws.courses;
        final today = DateTime.now().weekday % 7;
        final todays = courses.where((c) => c.days.contains(today)).toList();
        return Scaffold(
          appBar: AppBar(
            title: const Text('ClassManager'),
            actions: [
              TextButton.icon(
                icon: const Icon(Icons.school_outlined),
                label: const Text('Student'),
                onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const StudentPortal())),
              ),
              IconButton(icon: const Icon(Icons.settings_outlined), tooltip: 'Settings', onPressed: () => _settings(context)),
            ],
          ),
          floatingActionButton: FloatingActionButton.extended(
            onPressed: () => _newCourse(context),
            icon: const Icon(Icons.add),
            label: const Text('New course'),
          ),
          body: PageBox(
            child: ListView(
              padding: const EdgeInsets.all(16),
              children: [
                Text(store.ws.lecturerName.isEmpty ? 'Your classes' : 'Welcome, ${store.ws.lecturerName}',
                    style: Theme.of(context).textTheme.headlineSmall),
                if (store.ws.lecturerName.isEmpty)
                  const Padding(
                    padding: EdgeInsets.only(top: 6),
                    child: Text('Tip: set your name in Settings so it appears on reports and student share files.'),
                  ),
                if (todays.isNotEmpty) ...[
                  const SizedBox(height: 16),
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(12),
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text('Today’s classes', style: Theme.of(context).textTheme.titleMedium),
                        for (final c in todays)
                          ListTile(
                            dense: true,
                            title: Text('${c.code} ${c.title}'),
                            subtitle: Text('${c.time} ${c.room}'),
                            trailing: const Icon(Icons.chevron_right),
                            onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => CourseScreen(courseId: c.id, initialTab: 2))),
                          ),
                      ]),
                    ),
                  ),
                ],
                const SizedBox(height: 8),
                if (courses.isEmpty)
                  const Padding(padding: EdgeInsets.all(40), child: Center(child: Text('No courses yet. Tap “New course” to begin.')))
                else
                  for (final c in courses) _courseCard(context, c),
                const SizedBox(height: 80),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _courseCard(BuildContext context, Course c) {
    final risk = atRisk(c).length;
    return Card(
      child: InkWell(
        onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => CourseScreen(courseId: c.id))),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Expanded(child: Text('${c.code.isEmpty ? 'Untitled' : c.code}  §${c.section}', style: Theme.of(context).textTheme.titleMedium)),
              if (risk > 0) Pill('$risk at risk', Colors.red),
            ]),
            Text(c.title),
            Text('${c.days.map((d) => dayNames[d]).join('/')} ${c.time}  ${c.room}  ${c.semester}', style: Theme.of(context).textTheme.bodySmall),
            const SizedBox(height: 8),
            Text('${c.students.length} students · ${c.sessions.length} sessions · ${c.assessments.length} assessments'),
          ]),
        ),
      ),
    );
  }

  Future<void> _newCourse(BuildContext context) async {
    final code = TextEditingController(), title = TextEditingController(), section = TextEditingController(text: '1'), sem = TextEditingController();
    final ok = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('New course'),
        content: SingleChildScrollView(
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            TextField(controller: code, decoration: const InputDecoration(labelText: 'Course code (e.g. ESEM 303)'), autofocus: true),
            TextField(controller: title, decoration: const InputDecoration(labelText: 'Title')),
            TextField(controller: section, decoration: const InputDecoration(labelText: 'Section')),
            TextField(controller: sem, decoration: const InputDecoration(labelText: 'Semester')),
          ]),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.pop(context, true), child: const Text('Create')),
        ],
      ),
    );
    if (ok != true || code.text.trim().isEmpty || !context.mounted) return;
    final c = blankCourse(store.ws.lecturerName)
      ..code = code.text.trim()
      ..title = title.text.trim()
      ..section = section.text.trim().isEmpty ? '1' : section.text.trim()
      ..semester = sem.text.trim();
    store.mutate(() => store.ws.courses.add(c));
    Navigator.push(context, MaterialPageRoute(builder: (_) => CourseScreen(courseId: c.id, initialTab: 8)));
  }

  void _settings(BuildContext context) {
    showDialog(context: context, builder: (_) => const _SettingsDialog());
  }
}

class _SettingsDialog extends StatelessWidget {
  const _SettingsDialog();
  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Settings'),
      content: SizedBox(
        width: 420,
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
          CommitField(label: 'Your name', value: store.ws.lecturerName, onCommit: (v) => store.mutate(() => store.ws.lecturerName = v.trim())),
          const SizedBox(height: 16),
          const Text('All data is stored on this device. Back it up regularly; the backup also opens in the web app.'),
          const SizedBox(height: 8),
          Wrap(spacing: 8, children: [
            FilledButton(
              onPressed: () => saveFile(context, 'classmanager-backup-${todayIso()}.json', utf8.encode(store.exportJson())),
              child: const Text('Download backup'),
            ),
            OutlinedButton(
              onPressed: () async {
                final text = await pickTextFile();
                if (text == null || !context.mounted) return;
                try {
                  final n = (jsonDecode(text)['courses'] as List).length;
                  if (!await confirm(context, 'Replace everything on this device with $n course(s) from this backup?', action: 'Replace')) return;
                  store.replaceFromJson(text);
                  if (context.mounted) toast(context, 'Backup restored');
                } catch (_) {
                  if (context.mounted) toast(context, 'That file is not a ClassManager backup.');
                }
              },
              child: const Text('Restore backup…'),
            ),
          ]),
        ]),
      ),
      actions: [TextButton(onPressed: () => Navigator.pop(context), child: const Text('Close'))],
    );
  }
}
