import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api_client.dart';
import '../../services/google_auth.dart';
import '../../state/core_providers.dart';
import '../../state/settings.dart';
import '../theme.dart';
import '../widgets/saki_logo.dart';

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _name = TextEditingController();
  final _email = TextEditingController();
  final _password = TextEditingController();
  late final TextEditingController _server = TextEditingController(text: ref.read(settingsProvider).serverUrl);
  bool _register = false;
  bool _submitting = false;
  bool _googleBusy = false;
  bool _showServer = false;
  String _language = 'si-LK';
  String? _error;
  Map<String, String> _fieldErrors = const {};

  @override
  void dispose() {
    _name.dispose();
    _email.dispose();
    _password.dispose();
    _server.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _submitting = true;
      _error = null;
      _fieldErrors = const {};
    });
    try {
      await ref.read(settingsProvider.notifier).setServerUrl(_server.text);
      final auth = ref.read(authProvider.notifier);
      if (_register) {
        await auth.register(
          fullName: _name.text,
          email: _email.text,
          password: _password.text,
          preferredLanguage: _language,
        );
      } else {
        await auth.login(_email.text, _password.text);
      }
    } on ApiException catch (e) {
      if (mounted) {
        setState(() {
          _error = e.code == 'INVALID_CREDENTIALS' ? 'Invalid email or password.' : e.displayMessage;
          _fieldErrors = e.fieldErrors;
          if (e.code == 'NETWORK_ERROR') _showServer = true;
        });
      }
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  Future<void> _signInWithGoogle() async {
    setState(() {
      _googleBusy = true;
      _error = null;
      _fieldErrors = const {};
    });
    try {
      await ref.read(settingsProvider.notifier).setServerUrl(_server.text);
      await ref.read(authProvider.notifier).loginWithGoogle(preferredLanguage: _language);
    } on ApiException catch (e) {
      if (mounted) {
        setState(() {
          _error = e.displayMessage;
          if (e.code == 'NETWORK_ERROR') _showServer = true;
        });
      }
    } on GoogleAuthFailure catch (e) {
      if (mounted) setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _googleBusy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: Form(
                key: _formKey,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const Center(child: SakiLogo(size: 72, animated: true)),
                    const SizedBox(height: 18),
                    Text(
                      'Saki AI',
                      textAlign: TextAlign.center,
                      style: textTheme.headlineMedium?.copyWith(fontWeight: FontWeight.w700),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'Your Bilingual Coding Companion',
                      textAlign: TextAlign.center,
                      style: textTheme.bodyMedium?.copyWith(color: SakiColors.ink300),
                    ),
                    const SizedBox(height: 28),
                    SegmentedButton<bool>(
                      segments: const [
                        ButtonSegment(value: false, label: Text('Sign in')),
                        ButtonSegment(value: true, label: Text('Create account')),
                      ],
                      selected: {_register},
                      showSelectedIcon: false,
                      onSelectionChanged: (s) => setState(() {
                        _register = s.first;
                        _error = null;
                      }),
                    ),
                    const SizedBox(height: 20),
                    if (_register) ...[
                      TextFormField(
                        controller: _name,
                        decoration: InputDecoration(labelText: 'Full name', errorText: _fieldErrors['fullName']),
                        textInputAction: TextInputAction.next,
                        autofillHints: const [AutofillHints.name],
                        validator: (v) => (v == null || v.trim().isEmpty) ? 'Enter your name' : null,
                      ),
                      const SizedBox(height: 12),
                    ],
                    TextFormField(
                      controller: _email,
                      decoration: InputDecoration(labelText: 'Email', errorText: _fieldErrors['email']),
                      keyboardType: TextInputType.emailAddress,
                      textInputAction: TextInputAction.next,
                      autofillHints: const [AutofillHints.email],
                      validator: (v) => (v == null || !v.contains('@')) ? 'Enter a valid email' : null,
                    ),
                    const SizedBox(height: 12),
                    TextFormField(
                      controller: _password,
                      decoration: InputDecoration(labelText: 'Password', errorText: _fieldErrors['password']),
                      obscureText: true,
                      autofillHints: [_register ? AutofillHints.newPassword : AutofillHints.password],
                      onFieldSubmitted: (_) => _submit(),
                      validator: (v) => (v == null || v.length < 8) ? 'At least 8 characters' : null,
                    ),
                    if (_register) ...[
                      const SizedBox(height: 16),
                      Text('Preferred language', style: textTheme.labelMedium?.copyWith(color: SakiColors.ink300)),
                      const SizedBox(height: 8),
                      SegmentedButton<String>(
                        segments: [
                          ButtonSegment(
                            value: 'si-LK',
                            label: Text('සිංහල', style: SakiTheme.sinhala(const TextStyle())),
                          ),
                          const ButtonSegment(value: 'en-US', label: Text('English')),
                        ],
                        selected: {_language},
                        showSelectedIcon: false,
                        onSelectionChanged: (s) => setState(() => _language = s.first),
                      ),
                    ],
                    const SizedBox(height: 8),
                    Align(
                      alignment: Alignment.centerLeft,
                      child: TextButton.icon(
                        onPressed: () => setState(() => _showServer = !_showServer),
                        icon: Icon(_showServer ? Icons.expand_less : Icons.dns_outlined, size: 18),
                        label: const Text('Server settings'),
                      ),
                    ),
                    if (_showServer) ...[
                      TextFormField(
                        controller: _server,
                        decoration: const InputDecoration(
                          labelText: 'Saki backend URL',
                          helperText: 'On a real phone use your laptop\'s Wi-Fi IP, e.g. http://192.168.1.20:8080',
                          helperMaxLines: 2,
                        ),
                        keyboardType: TextInputType.url,
                        validator: (v) => (v == null || v.trim().isEmpty) ? 'Enter the server address' : null,
                      ),
                      const SizedBox(height: 8),
                    ],
                    if (_error != null)
                      Container(
                        margin: const EdgeInsets.only(top: 8),
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: SakiColors.recording.withValues(alpha: 0.12),
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(color: SakiColors.recording.withValues(alpha: 0.4)),
                        ),
                        child: Text(_error!, style: const TextStyle(color: Color(0xFFFDA4AF))),
                      ),
                    const SizedBox(height: 16),
                    DecoratedBox(
                      decoration: BoxDecoration(gradient: SakiColors.gradient, borderRadius: BorderRadius.circular(12)),
                      child: FilledButton(
                        style: FilledButton.styleFrom(
                          backgroundColor: Colors.transparent,
                          foregroundColor: SakiColors.ink950,
                          minimumSize: const Size.fromHeight(50),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                          textStyle: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15),
                        ),
                        onPressed: _submitting ? null : _submit,
                        child: _submitting
                            ? const SizedBox(
                                width: 22,
                                height: 22,
                                child: CircularProgressIndicator(strokeWidth: 2.5, color: SakiColors.ink950),
                              )
                            : Text(_register ? 'Create my Saki account' : 'Sign in to Saki'),
                      ),
                    ),
                    if (ref.watch(googleClientIdProvider).value != null) ...[
                      const SizedBox(height: 18),
                      const Row(children: [
                        Expanded(child: Divider(color: SakiColors.ink700)),
                        Padding(
                          padding: EdgeInsets.symmetric(horizontal: 12),
                          child: Text('or', style: TextStyle(color: SakiColors.ink400, fontSize: 12)),
                        ),
                        Expanded(child: Divider(color: SakiColors.ink700)),
                      ]),
                      const SizedBox(height: 18),
                      OutlinedButton(
                        style: OutlinedButton.styleFrom(
                          minimumSize: const Size.fromHeight(50),
                          foregroundColor: SakiColors.ink100,
                          side: const BorderSide(color: SakiColors.ink700),
                          shape: const StadiumBorder(),
                          textStyle: const TextStyle(fontWeight: FontWeight.w600, fontSize: 15),
                        ),
                        onPressed: _submitting || _googleBusy ? null : _signInWithGoogle,
                        child: _googleBusy
                            ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2.5))
                            : Row(mainAxisSize: MainAxisSize.min, children: [
                                const _GoogleMark(),
                                const SizedBox(width: 10),
                                Text(_register ? 'Sign up with Google' : 'Continue with Google'),
                              ]),
                      ),
                    ],
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// Simple Google "G" badge (no bundled brand asset needed).
class _GoogleMark extends StatelessWidget {
  const _GoogleMark();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 22,
      height: 22,
      alignment: Alignment.center,
      decoration: const BoxDecoration(color: Colors.white, shape: BoxShape.circle),
      child: const Text('G', style: TextStyle(color: Color(0xFF4285F4), fontWeight: FontWeight.w800, fontSize: 14)),
    );
  }
}
