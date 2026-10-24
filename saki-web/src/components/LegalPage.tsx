import type { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import { SakiLogo } from '@/components/SakiLogo';
import { ThemeToggle } from '@/components/ThemeToggle';

const LAST_UPDATED = 'October 25, 2026';
const CONTACT_URL = 'https://github.com/Mihiran-Thilakarathna/Saki-AI/issues';

export type LegalKind = 'privacy' | 'terms';

/** Public Privacy Policy and Terms of Service pages (/privacy, /terms). */
export function LegalPage({ kind }: { kind: LegalKind }) {
  const privacy = kind === 'privacy';
  return (
    <div className="min-h-full bg-ink-900">
      <header className="border-b border-ink-700 bg-ink-850">
        <div className="mx-auto flex h-14 max-w-3xl items-center gap-3 px-4 sm:px-6">
          <a href="/" className="flex items-center gap-2.5" aria-label="Back to Saki AI">
            <SakiLogo size={30} />
            <span className="text-[15px] font-semibold tracking-tight">Saki AI</span>
          </a>
          <div className="ml-auto flex items-center gap-1">
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <a href="/" className="inline-flex items-center gap-1.5 text-sm text-ink-400 hover:text-ink-100">
          <ArrowLeft className="h-4 w-4" /> Back to Saki
        </a>
        <h1 className="mt-6 text-3xl font-semibold tracking-tight">{privacy ? 'Privacy Policy' : 'Terms of Service'}</h1>
        <p className="mt-2 text-sm text-ink-400">Last updated: {LAST_UPDATED}</p>

        <article className="legal mt-8">{privacy ? <PrivacyPolicy /> : <TermsOfService />}</article>

        <footer className="mt-12 flex flex-wrap gap-x-4 gap-y-1 border-t border-ink-700 pt-6 text-sm text-ink-400">
          <a href="/privacy" className="hover:text-ink-100">Privacy Policy</a>
          <a href="/terms" className="hover:text-ink-100">Terms of Service</a>
          <a href={CONTACT_URL} target="_blank" rel="noreferrer" className="hover:text-ink-100">Contact</a>
        </footer>
      </main>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold text-ink-100">{title}</h2>
      <div className="mt-2 space-y-3 text-[15px] leading-relaxed text-ink-200">{children}</div>
    </section>
  );
}

function PrivacyPolicy() {
  return (
    <>
      <p className="text-[15px] leading-relaxed text-ink-200">
        Saki AI (“Saki”, “we”) is a voice coding assistant that answers programming questions in Sinhala and English.
        This policy explains what information Saki collects, how it is used and the choices you have.
      </p>

      <Section title="Information we collect">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>Account details:</strong> your name and email address. If you sign up with a password, we store only a
            secure one-way hash of it (BCrypt), never the password itself. If you sign in with Google, we receive your
            name, email address and Google account identifier from Google; we do not receive your Google password.
          </li>
          <li>
            <strong>Your conversations:</strong> the text of your questions (for voice questions, the transcript), Saki’s
            answers and explanations, and the code in your editor, saved in your chats so you can return to them.
          </li>
          <li>
            <strong>Voice recordings:</strong> when you ask by voice, the recording is sent for transcription and answering
            and is <strong>not stored</strong> by Saki.
          </li>
          <li>
            <strong>Saki’s spoken answers:</strong> the audio of Saki’s answers is saved with your chat so you can play
            or download it again later, and is deleted together with the chat.
          </li>
          <li>
            <strong>Files you import:</strong> a code file you open is placed in your editor and saved with that chat, like
            code you type.
          </li>
          <li>
            <strong>Technical data:</strong> basic server logs (such as time, request type and IP address) used for security,
            abuse prevention and fixing errors. Logs do not contain the content of your questions.
          </li>
        </ul>
      </Section>

      <Section title="How we use your information">
        <ul className="list-disc space-y-2 pl-5">
          <li>To provide the service: sign you in, answer your questions, speak the answers and keep your chats.</li>
          <li>To keep the service secure: rate limits, preventing abuse and investigating problems.</li>
        </ul>
        <p>
          We do <strong>not</strong> sell your data, show advertising, or use third-party analytics or tracking cookies.
        </p>
      </Section>

      <Section title="Services that process your data">
        <p>Saki relies on these providers, each under its own terms and privacy policy:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>Google Gemini API:</strong> your question (text or voice recording), recent chat history and the code in
            your editor are sent to Google to generate the answer and its spoken audio.
          </li>
          <li>
            <strong>Google Sign-In:</strong> if you choose to sign in with Google.
          </li>
          <li>
            <strong>Render</strong> (application server), <strong>Neon</strong> (database) and <strong>Vercel</strong>{' '}
            (website hosting).
          </li>
        </ul>
        <p>Please do not include passwords, API keys or other secrets in your questions or code.</p>
      </Section>

      <Section title="Storage in your browser">
        <p>
          Saki stores your sign-in token and preferences (such as light or dark theme and mute) in your browser’s local
          storage so you stay signed in. Signing out removes the token. Saki does not use cookies for tracking.
        </p>
      </Section>

      <Section title="Security">
        <p>
          Connections use HTTPS. Passwords are hashed, every chat is only accessible to its owner, and the service applies
          rate limits and strict browser security policies. No online service can be guaranteed to be perfectly secure,
          but we work to protect your information.
        </p>
      </Section>

      <Section title="Keeping and deleting your data">
        <p>
          Your chats are kept until you delete them; deleting a chat removes its messages and code. To delete your account
          and all of its data, contact us using the link below and we will remove it.
        </p>
      </Section>

      <Section title="Children">
        <p>Saki is not directed to children under 13, and we do not knowingly collect their personal information.</p>
      </Section>

      <Section title="Changes and contact">
        <p>
          We may update this policy; the date above shows the latest version. Questions or requests:{' '}
          <a href={CONTACT_URL} target="_blank" rel="noreferrer" className="text-saki-400 underline">
            contact us on GitHub
          </a>
          .
        </p>
      </Section>
    </>
  );
}

function TermsOfService() {
  return (
    <>
      <p className="text-[15px] leading-relaxed text-ink-200">
        These terms apply to your use of Saki AI (“Saki”). By creating an account or using Saki, you agree to them.
      </p>

      <Section title="The service">
        <p>
          Saki is a free AI assistant that answers programming questions by voice or text and writes example code. It is
          provided “as is”, and features may change or stop at any time. Free hosting means Saki may be slow to start or
          occasionally unavailable.
        </p>
      </Section>

      <Section title="AI answers">
        <p>
          Saki uses artificial intelligence and <strong>can make mistakes</strong>. Answers and code may be incomplete,
          insecure or wrong. Review and test anything Saki produces before relying on it; you are responsible for how you
          use it.
        </p>
      </Section>

      <Section title="Your account">
        <ul className="list-disc space-y-2 pl-5">
          <li>Provide accurate information and keep your password secure.</li>
          <li>You are responsible for activity under your account.</li>
        </ul>
      </Section>

      <Section title="Acceptable use">
        <p>Do not use Saki to:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>break the law or infringe the rights of others;</li>
          <li>create malware or attack, probe or overload any system, including Saki;</li>
          <li>get around rate limits or security measures, or access other users’ data;</li>
          <li>submit content you do not have the right to share.</li>
        </ul>
        <p>Accounts that misuse the service may be limited or removed.</p>
      </Section>

      <Section title="Your content">
        <p>
          You keep ownership of the questions and code you submit. You allow Saki to process them only to provide the
          service, as described in the{' '}
          <a href="/privacy" className="text-saki-400 underline">
            Privacy Policy
          </a>
          .
        </p>
      </Section>

      <Section title="Limitation of liability">
        <p>
          To the extent permitted by law, Saki and its developer are not liable for any loss or damage arising from your use
          of the service or of answers and code it provides.
        </p>
      </Section>

      <Section title="Changes and contact">
        <p>
          We may update these terms; the date above shows the latest version. Questions:{' '}
          <a href={CONTACT_URL} target="_blank" rel="noreferrer" className="text-saki-400 underline">
            contact us on GitHub
          </a>
          .
        </p>
      </Section>
    </>
  );
}
