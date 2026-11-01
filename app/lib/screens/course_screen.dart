import 'package:flutter/material.dart';
import '../main.dart';
import 'tabs_a.dart';
import 'tabs_b.dart';
import 'tabs_c.dart';

class CourseScreen extends StatelessWidget {
  final String courseId;
  final int initialTab;
  const CourseScreen({super.key, required this.courseId, this.initialTab = 0});

  static const _titles = ['Overview', 'Roster', 'Attendance', 'Gradebook', 'Analysis', 'At-risk', 'Announcements', 'Share', 'Settings'];

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: store,
      builder: (context, _) {
        final c = store.course(courseId);
        if (c == null) return const Scaffold(body: Center(child: Text('Course not found')));
        return DefaultTabController(
          length: _titles.length,
          initialIndex: initialTab,
          child: Scaffold(
            appBar: AppBar(
              title: Text('${c.code} §${c.section}'),
              bottom: TabBar(isScrollable: true, tabAlignment: TabAlignment.start, tabs: [for (final t in _titles) Tab(text: t)]),
            ),
            body: TabBarView(
              physics: const NeverScrollableScrollPhysics(),
              children: [
                OverviewTab(c),
                RosterTab(c),
                AttendanceTab(c),
                GradebookTab(c),
                AnalysisTab(c),
                RiskTab(c),
                AnnouncementsTab(c),
                ShareTab(c),
                CourseSettingsTab(c),
              ],
            ),
          ),
        );
      },
    );
  }
}
