import 'package:flutter/material.dart';
import 'screens/home_screen.dart';
import 'store.dart';

final store = AppStore();

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await store.load();
  runApp(const ClassManagerApp());
}

class ClassManagerApp extends StatelessWidget {
  const ClassManagerApp({super.key});

  @override
  Widget build(BuildContext context) {
    const seed = Color(0xFF1F4E79);
    return MaterialApp(
      title: 'ClassManager',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(useMaterial3: true, colorSchemeSeed: seed, visualDensity: VisualDensity.adaptivePlatformDensity),
      darkTheme: ThemeData(useMaterial3: true, colorSchemeSeed: seed, brightness: Brightness.dark),
      home: const HomeScreen(),
    );
  }
}
