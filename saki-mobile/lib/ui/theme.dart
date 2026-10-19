import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

/// Shared palette with saki-web (teal → violet on deep ink).
class SakiColors {
  static const ink950 = Color(0xFF07090F);
  static const ink900 = Color(0xFF0B0F17);
  static const ink850 = Color(0xFF0F141E);
  static const ink800 = Color(0xFF131A26);
  static const ink700 = Color(0xFF1F293B);
  static const ink600 = Color(0xFF2A3548);
  static const ink400 = Color(0xFF6B7A90);
  static const ink300 = Color(0xFF8B98A9);
  static const ink200 = Color(0xFFB6C2D1);
  static const ink100 = Color(0xFFE6EDF3);
  static const saki300 = Color(0xFF5EEAD4);
  static const saki400 = Color(0xFF2DD4BF);
  static const saki500 = Color(0xFF14B8A6);
  static const iris400 = Color(0xFFA78BFA);
  static const iris500 = Color(0xFF8B5CF6);
  static const recording = Color(0xFFF43F5E);
  static const success = Color(0xFF34D399);
  static const warning = Color(0xFFFBBF24);

  static const gradient = LinearGradient(
    colors: [saki400, iris500],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );
}

class SakiTheme {
  static TextStyle sinhala(TextStyle base) =>
      GoogleFonts.notoSansSinhala(textStyle: base.copyWith(height: 1.6));

  static TextStyle mono({double size = 13, Color color = SakiColors.ink100}) =>
      GoogleFonts.jetBrainsMono(fontSize: size, color: color, height: 1.45);

  static ThemeData dark() {
    final base = ThemeData(
      useMaterial3: true,
      brightness: Brightness.dark,
      colorScheme: ColorScheme.fromSeed(
        seedColor: SakiColors.saki400,
        brightness: Brightness.dark,
        primary: SakiColors.saki400,
        secondary: SakiColors.iris500,
        surface: SakiColors.ink900,
        error: SakiColors.recording,
      ),
      scaffoldBackgroundColor: SakiColors.ink900,
    );
    // Inter for Latin text, falling back to Noto Sans Sinhala for සිංහල glyphs.
    final textTheme = GoogleFonts.interTextTheme(base.textTheme).apply(
      bodyColor: SakiColors.ink100,
      displayColor: SakiColors.ink100,
      fontFamilyFallback: [GoogleFonts.notoSansSinhala().fontFamily!],
    );
    return base.copyWith(
      textTheme: textTheme,
      appBarTheme: const AppBarTheme(
        backgroundColor: SakiColors.ink850,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        centerTitle: false,
      ),
      dividerColor: SakiColors.ink700,
      bottomSheetTheme: const BottomSheetThemeData(
        backgroundColor: SakiColors.ink850,
        surfaceTintColor: Colors.transparent,
        showDragHandle: true,
      ),
      snackBarTheme: const SnackBarThemeData(
        behavior: SnackBarBehavior.floating,
        backgroundColor: SakiColors.ink700,
        contentTextStyle: TextStyle(color: SakiColors.ink100),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: SakiColors.ink850,
        hintStyle: const TextStyle(color: SakiColors.ink400),
        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: SakiColors.ink700),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: SakiColors.ink700),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: SakiColors.saki500, width: 1.5),
        ),
      ),
      segmentedButtonTheme: SegmentedButtonThemeData(
        style: ButtonStyle(
          visualDensity: VisualDensity.compact,
          side: const WidgetStatePropertyAll(BorderSide(color: SakiColors.ink700)),
          backgroundColor: WidgetStateProperty.resolveWith(
            (states) => states.contains(WidgetState.selected) ? SakiColors.saki500.withValues(alpha: 0.18) : null,
          ),
        ),
      ),
    );
  }
}

extension SinhalaText on TextStyle {
  /// Applies the Sinhala font when [isSinhala] is true.
  TextStyle forLanguage(bool isSinhala) => isSinhala ? SakiTheme.sinhala(this) : this;
}
