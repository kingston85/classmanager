import 'package:flutter/material.dart';

/// A text field that commits its value when the user leaves it or presses enter.
class CommitField extends StatefulWidget {
  final String value;
  final String? label;
  final double? width;
  final TextInputType? keyboard;
  final bool alignRight;
  final void Function(String) onCommit;
  const CommitField({super.key, required this.value, required this.onCommit, this.label, this.width, this.keyboard, this.alignRight = false});

  @override
  State<CommitField> createState() => _CommitFieldState();
}

class _CommitFieldState extends State<CommitField> {
  late final TextEditingController _c = TextEditingController(text: widget.value);
  final FocusNode _f = FocusNode();

  @override
  void initState() {
    super.initState();
    _f.addListener(() {
      if (!_f.hasFocus) widget.onCommit(_c.text);
    });
  }

  @override
  void didUpdateWidget(CommitField old) {
    super.didUpdateWidget(old);
    if (!_f.hasFocus && widget.value != _c.text) _c.text = widget.value;
  }

  @override
  void dispose() {
    _c.dispose();
    _f.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final field = TextField(
      controller: _c,
      focusNode: _f,
      keyboardType: widget.keyboard,
      textAlign: widget.alignRight ? TextAlign.right : TextAlign.start,
      decoration: InputDecoration(labelText: widget.label, isDense: true, border: const OutlineInputBorder()),
      onSubmitted: widget.onCommit,
    );
    return widget.width == null ? field : SizedBox(width: widget.width, child: field);
  }
}

class StatCard extends StatelessWidget {
  final String value, label;
  const StatCard(this.value, this.label, {super.key});
  @override
  Widget build(BuildContext context) => Card(
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(value, style: Theme.of(context).textTheme.headlineMedium?.copyWith(fontWeight: FontWeight.bold)),
            Text(label, style: Theme.of(context).textTheme.bodySmall),
          ]),
        ),
      );
}

class Pill extends StatelessWidget {
  final String text;
  final Color color;
  const Pill(this.text, this.color, {super.key});
  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
        decoration: BoxDecoration(color: color.withValues(alpha: .18), borderRadius: BorderRadius.circular(99)),
        child: Text(text, style: TextStyle(color: color, fontWeight: FontWeight.w600, fontSize: 12)),
      );
}

/// Centres content and caps its width so forms do not stretch across a wide Windows window.
class PageBox extends StatelessWidget {
  final Widget child;
  final double maxWidth;
  const PageBox({super.key, required this.child, this.maxWidth = 1000});
  @override
  Widget build(BuildContext context) => Align(
        alignment: Alignment.topCenter,
        child: ConstrainedBox(constraints: BoxConstraints(maxWidth: maxWidth), child: child),
      );
}

Future<bool> confirm(BuildContext context, String message, {String action = 'Delete'}) async {
  final ok = await showDialog<bool>(
    context: context,
    builder: (_) => AlertDialog(
      content: Text(message),
      actions: [
        TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
        FilledButton(onPressed: () => Navigator.pop(context, true), child: Text(action)),
      ],
    ),
  );
  return ok ?? false;
}

void toast(BuildContext context, String msg) =>
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
