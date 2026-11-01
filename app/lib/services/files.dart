import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';

/// Save bytes through the platform's "save as" dialog (Android: system picker, Windows: save dialog).
Future<void> saveFile(BuildContext context, String fileName, List<int> bytes) async {
  final data = Uint8List.fromList(bytes);
  try {
    final path = await FilePicker.platform.saveFile(dialogTitle: 'Save $fileName', fileName: fileName, bytes: data);
    if (path != null && (Platform.isWindows || Platform.isLinux || Platform.isMacOS)) {
      await File(path).writeAsBytes(data);
    }
    if (context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(path == null ? 'Save cancelled' : 'Saved $fileName')));
    }
  } catch (e) {
    if (context.mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Could not save: $e')));
  }
}

/// Let the user pick a text/JSON file and return its contents (null if cancelled).
Future<String?> pickTextFile() async {
  final res = await FilePicker.platform.pickFiles(type: FileType.any, withData: true);
  if (res == null || res.files.isEmpty) return null;
  final f = res.files.first;
  if (f.bytes != null) return utf8.decode(f.bytes!, allowMalformed: true);
  if (f.path != null) return File(f.path!).readAsString();
  return null;
}
