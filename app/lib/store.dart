import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'models.dart';

const _key = 'classmanager.workspace.v1';

class AppStore extends ChangeNotifier {
  Workspace ws = Workspace();
  SharedPreferences? _prefs;

  Future<void> load() async {
    _prefs = await SharedPreferences.getInstance();
    final raw = _prefs!.getString(_key);
    if (raw != null) {
      try {
        ws = Workspace.fromJson(jsonDecode(raw) as Map<String, dynamic>);
      } catch (_) {
        ws = Workspace();
      }
    }
    notifyListeners();
  }

  /// Apply a change, save, and rebuild listeners.
  void mutate(VoidCallback fn) {
    fn();
    _prefs?.setString(_key, jsonEncode(ws.toJson()));
    notifyListeners();
  }

  String exportJson() => const JsonEncoder.withIndent('  ').convert(ws.toJson());

  void replaceFromJson(String text) {
    final next = Workspace.fromJson(jsonDecode(text) as Map<String, dynamic>);
    mutate(() => ws = next);
  }

  Course? course(String id) {
    for (final c in ws.courses) {
      if (c.id == id) return c;
    }
    return null;
  }
}
