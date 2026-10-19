package com.sakiai.backend.service.ai;

import java.util.regex.Pattern;

/**
 * Turns Saki's answer into clean speech: strips markdown and stray code syntax so the
 * neural TTS never reads out braces, backticks or asterisks, and never reads code blocks.
 */
public final class SpokenTextSanitizer {

    private static final Pattern FENCED_CODE = Pattern.compile("```.*?```", Pattern.DOTALL);
    private static final Pattern INLINE_CODE = Pattern.compile("`([^`]*)`");
    private static final Pattern MARKDOWN_LINK = Pattern.compile("\\[([^]]+)]\\([^)]*\\)");
    private static final Pattern MARKDOWN_SYMBOLS = Pattern.compile("(\\*\\*|__|(?<![A-Za-z])#|[*>~])");
    private static final Pattern CODE_SYMBOLS = Pattern.compile("[{}\\[\\];<>|\\\\]");
    private static final Pattern WHITESPACE = Pattern.compile("\\s+");
    /** Bullet or numbered-list marker at the start of a markdown line. */
    private static final Pattern LIST_MARKER = Pattern.compile("^\\s*(?:[-*+]|\\d+[.)])\\s+");
    /** "()" after a method name reads badly aloud ("sort()" -> "sort"). */
    private static final Pattern EMPTY_PARENS = Pattern.compile("\\(\\s*\\)");

    private SpokenTextSanitizer() {
    }

    public static String sanitize(String text) {
        if (text == null) {
            return "";
        }
        String cleaned = FENCED_CODE.matcher(text).replaceAll(" ");
        cleaned = INLINE_CODE.matcher(cleaned).replaceAll("$1");
        cleaned = MARKDOWN_LINK.matcher(cleaned).replaceAll("$1");
        cleaned = MARKDOWN_SYMBOLS.matcher(cleaned).replaceAll("");
        cleaned = CODE_SYMBOLS.matcher(cleaned).replaceAll(" ");
        return WHITESPACE.matcher(cleaned).replaceAll(" ").trim();
    }

    /**
     * The full answer as Saki says it: the spoken summary followed by the explanation
     * points, each read as its own sentence. Code blocks are dropped (the code is in the
     * editor); inline identifiers such as {@code useState} are kept as words.
     */
    public static String forSpeech(String spokenResponse, String explanationMarkdown) {
        StringBuilder speech = new StringBuilder(sanitize(spokenResponse));
        if (explanationMarkdown == null || explanationMarkdown.isBlank()) {
            return speech.toString();
        }
        String withoutCode = FENCED_CODE.matcher(explanationMarkdown).replaceAll("\n");
        for (String line : withoutCode.split("\\R")) {
            String point = sanitize(LIST_MARKER.matcher(line).replaceFirst(""));
            point = EMPTY_PARENS.matcher(point).replaceAll("").trim();
            if (point.isEmpty()) {
                continue;
            }
            if (speech.length() > 0) {
                appendSentenceEnd(speech);
                speech.append(' ');
            }
            speech.append(point);
        }
        if (speech.length() > 0) {
            appendSentenceEnd(speech);
        }
        return speech.toString();
    }

    /** Ends the text with a full stop unless it already ends a sentence, so TTS pauses between points. */
    private static void appendSentenceEnd(StringBuilder text) {
        char last = text.charAt(text.length() - 1);
        if (".!?।:".indexOf(last) < 0) {
            text.append('.');
        }
    }

    /**
     * Caps text at {@code maxChars}, preferring to cut at the end of a sentence
     * (".", "!", "?", or the Sinhala/Devanagari danda "।").
     */
    public static String truncateForSpeech(String text, int maxChars) {
        if (text == null || text.length() <= maxChars) {
            return text;
        }
        String head = text.substring(0, maxChars);
        int cut = Math.max(Math.max(head.lastIndexOf(". "), head.lastIndexOf("! ")),
                Math.max(head.lastIndexOf("? "), head.lastIndexOf("। ")));
        if (cut >= maxChars / 2) {
            return head.substring(0, cut + 1).trim();
        }
        int space = head.lastIndexOf(' ');
        return (space > 0 ? head.substring(0, space) : head).trim();
    }
}
