package com.sakiai.backend.service.ai;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class SpokenTextSanitizerTest {

    @Test
    void stripsCodeAndMarkdownButKeepsWords() {
        String input = "**Great** question! Use `useState` here. ```js\nconst x = {};\n``` Check the editor; it has [docs](http://x).";

        String cleaned = SpokenTextSanitizer.sanitize(input);

        assertThat(cleaned).isEqualTo("Great question! Use useState here. Check the editor it has docs.");
    }

    @Test
    void keepsCSharpName() {
        assertThat(SpokenTextSanitizer.sanitize("In C# you would use a record.")).contains("C#");
    }

    @Test
    void truncatesAtSentenceBoundary() {
        String text = "First sentence here. Second sentence is longer than the limit allows for sure.";

        assertThat(SpokenTextSanitizer.truncateForSpeech(text, 35)).isEqualTo("First sentence here.");
    }

    @Test
    void speechIncludesTheExplanationPointsAsSentences() {
        String speech = SpokenTextSanitizer.forSpeech(
                "React හි useState භාවිත කරන්නේ state කළමනාකරණය කිරීමටයි",
                """
                * **useState**: Component එකෙහි internal state කළමනාකරණය කරයි. State වෙනස් වන විට component එක re-render වේ.
                * **useEffect**: `fetch()` වැනි side effects සිදු කරයි
                """);

        assertThat(speech).isEqualTo("React හි useState භාවිත කරන්නේ state කළමනාකරණය කිරීමටයි. "
                + "useState: Component එකෙහි internal state කළමනාකරණය කරයි. State වෙනස් වන විට component එක re-render වේ. "
                + "useEffect: fetch වැනි side effects සිදු කරයි.");
    }

    @Test
    void speechNeverReadsCodeBlocks() {
        String speech = SpokenTextSanitizer.forSpeech("Here is the approach.", """
                1. Sort with Collections.sort
                ```java
                Collections.sort(list);
                ```
                2. Or use list.sort with a Comparator
                """);

        assertThat(speech).isEqualTo("Here is the approach. Sort with Collections.sort. Or use list.sort with a Comparator.")
                .doesNotContain("Collections.sort(list)");
    }

    @Test
    void speechWithoutExplanationIsJustTheAnswer() {
        assertThat(SpokenTextSanitizer.forSpeech("Done.", null)).isEqualTo("Done.");
        assertThat(SpokenTextSanitizer.forSpeech("Done.", "  ")).isEqualTo("Done.");
    }
}
