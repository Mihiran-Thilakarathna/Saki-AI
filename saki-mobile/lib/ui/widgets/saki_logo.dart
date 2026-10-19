import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../theme.dart';

/// Saki's five-bar voice mark; bars bounce while [animated] (Saki speaking / thinking).
class SakiLogo extends StatefulWidget {
  const SakiLogo({super.key, this.size = 32, this.animated = false});

  final double size;
  final bool animated;

  @override
  State<SakiLogo> createState() => _SakiLogoState();
}

class _SakiLogoState extends State<SakiLogo> with SingleTickerProviderStateMixin {
  late final AnimationController _controller =
      AnimationController(vsync: this, duration: const Duration(milliseconds: 1000));

  @override
  void initState() {
    super.initState();
    if (widget.animated) _controller.repeat();
  }

  @override
  void didUpdateWidget(SakiLogo oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.animated && !_controller.isAnimating) {
      _controller.repeat();
    } else if (!widget.animated && _controller.isAnimating) {
      _controller.stop();
      _controller.value = 0;
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      width: widget.size,
      height: widget.size,
      decoration: BoxDecoration(
        gradient: SakiColors.gradient,
        borderRadius: BorderRadius.circular(widget.size / 4),
      ),
      child: AnimatedBuilder(
        animation: _controller,
        builder: (context, _) => CustomPaint(painter: _BarsPainter(widget.animated ? _controller.value : null)),
      ),
    );
  }
}

class _BarsPainter extends CustomPainter {
  _BarsPainter(this.phase);

  final double? phase;
  static const _heights = [12.0, 28.0, 20.0, 36.0, 10.0];
  static const _xs = [14.0, 23.0, 32.0, 41.0, 50.0];

  @override
  void paint(Canvas canvas, Size size) {
    final scale = size.width / 64;
    final paint = Paint()..color = SakiColors.ink900;
    for (var i = 0; i < _heights.length; i++) {
      var height = _heights[i];
      final p = phase;
      if (p != null) {
        final wave = (math.sin((p * 2 * math.pi) - i * 0.9) + 1) / 2;
        height = 8 + wave * 30;
      }
      final width = i == 4 ? 4.0 : 5.0;
      final rect = Rect.fromLTWH(_xs[i] * scale, (32 - height / 2) * scale, width * scale, height * scale);
      canvas.drawRRect(RRect.fromRectAndRadius(rect, Radius.circular(2.5 * scale)), paint);
    }
  }

  @override
  bool shouldRepaint(_BarsPainter oldDelegate) => oldDelegate.phase != phase;
}
