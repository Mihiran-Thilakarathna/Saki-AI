import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'state/core_providers.dart';
import 'ui/screens/home_screen.dart';
import 'ui/screens/login_screen.dart';
import 'ui/theme.dart';
import 'ui/widgets/saki_logo.dart';

class SakiApp extends StatelessWidget {
  const SakiApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Saki AI',
      debugShowCheckedModeBanner: false,
      theme: SakiTheme.dark(),
      home: const _AuthGate(),
    );
  }
}

class _AuthGate extends ConsumerWidget {
  const _AuthGate();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final auth = ref.watch(authProvider);
    return auth.when(
      loading: () => const Scaffold(body: Center(child: SakiLogo(size: 72, animated: true))),
      error: (_, _) => const LoginScreen(),
      data: (session) => AnimatedSwitcher(
        duration: const Duration(milliseconds: 250),
        child: session == null ? const LoginScreen() : HomeScreen(key: ValueKey(session.user.id)),
      ),
    );
  }
}
