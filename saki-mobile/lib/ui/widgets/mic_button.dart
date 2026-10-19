import 'dart:async';

import 'package:flutter/material.dart';

import '../theme.dart';

/// Animated "Hey Saki" mic: tap to start/stop, or press-and-hold to talk.
/// Pulse rings follow the live input level while recording.
class MicButton extends StatefulWidget {
  const MicButton({
    super.key,
    required this.size,
    required this.recording,
    required this.busy,
    required this.wakeListening,
    required this.levels,
    required this.onTap,
    required this.onHoldStart,
    required this.onHoldEnd,
  });

  final double size;
  final bool recording;
  final bool busy;
  final bool wakeListening;
  final Stream<double> levels;
  final VoidCallback onTap;
  final VoidCallback onHoldStart;
  final VoidCallback onHoldEnd;

  @override
  State<MicButton> createState() => _MicButtonState();
}

class _MicButtonState extends State<MicButton> with SingleTickerProviderStateMixin {
  late final AnimationController _pulse =
      AnimationController(vsync: this, duration: const Duration(milliseconds: 1600))..repeat();
  StreamSubscription<double>? _levelSub;
  double _level = 0;

  @override
  void initState() {
    super.initState();
    _subscribe();
  }

  @override
  void didUpdateWidget(MicButton oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.levels != widget.levels) _subscribe();
    if (!widget.recording && _level != 0) setState(() => _level = 0);
  }

  void _subscribe() {
    unawaited(_levelSub?.cancel());
    _levelSub = widget.levels.listen((rms) {
      // Compress speech RMS (~0.01–0.3) into a lively 0–1 range, with smoothing.
      final target = (rms * 6).clamp(0.0, 1.0);
      if (mounted && widget.recording) setState(() => _level = _level * 0.6 + target * 0.4);
    });
  }

  @override
  void dispose() {
    unawaited(_levelSub?.cancel());
    _pulse.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final size = widget.size;
    final ringColor = widget.recording ? SakiColors.recording : SakiColors.saki400;
    final showRings = widget.recording || widget.wakeListening;

    return Semantics(
      button: true,
      label: widget.recording ? 'Stop recording and send to Saki' : 'Talk to Saki',
      child: GestureDetector(
        onTap: widget.busy && !widget.recording ? null : widget.onTap,
        onLongPressStart: widget.busy || widget.recording ? null : (_) => widget.onHoldStart(),
        onLongPressEnd: (_) => widget.onHoldEnd(),
        child: SizedBox(
          width: size * 1.6,
          height: size * 1.6,
          child: Stack(
            alignment: Alignment.center,
            children: [
              if (showRings)
                AnimatedBuilder(
                  animation: _pulse,
                  builder: (context, _) {
                    return Stack(
                      alignment: Alignment.center,
                      children: [
                        for (final offset in [0.0, 0.5])
                          _ring(((_pulse.value + offset) % 1.0), ringColor, size),
                      ],
                    );
                  },
                ),
              if (widget.recording)
                AnimatedContainer(
                  duration: const Duration(milliseconds: 90),
                  width: size * (1.05 + _level * 0.5),
                  height: size * (1.05 + _level * 0.5),
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: SakiColors.recording.withValues(alpha: 0.25),
                  ),
                ),
              AnimatedContainer(
                duration: const Duration(milliseconds: 200),
                width: size,
                height: size,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: widget.recording ? null : SakiColors.gradient,
                  color: widget.recording ? SakiColors.recording : null,
                  boxShadow: [
                    BoxShadow(color: ringColor.withValues(alpha: 0.35), blurRadius: size * 0.3, spreadRadius: 1),
                  ],
                ),
                child: Center(
                  child: widget.busy && !widget.recording
                      ? SizedBox(
                          width: size * 0.36,
                          height: size * 0.36,
                          child: const CircularProgressIndicator(strokeWidth: 3, color: SakiColors.ink950),
                        )
                      : Icon(
                          widget.recording ? Icons.stop_rounded : Icons.mic_rounded,
                          size: size * 0.45,
                          color: widget.recording ? Colors.white : SakiColors.ink950,
                        ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _ring(double t, Color color, double size) {
    final diameter = size * (1 + t * 0.6);
    return Container(
      width: diameter,
      height: diameter,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        border: Border.all(color: color.withValues(alpha: (1 - t) * 0.6), width: 2),
      ),
    );
  }
}
