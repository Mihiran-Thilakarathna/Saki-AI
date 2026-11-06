import { useEffect, useState, type ReactNode } from 'react';
import { ArrowLeft, Ban, Mail, MicOff, Trash2 } from 'lucide-react';
import { SakiLogo } from '@/components/SakiLogo';
import { ThemeToggle } from '@/components/ThemeToggle';

const LAST_UPDATED = 'October 25, 2026';
const CONTACT_URL = 'https://github.com/Mihiran-Thilakarathna/Saki-AI/issues';

export type LegalKind = 'privacy' | 'terms';

interface LegalSection {
  id: string;
  title: string;
  body: ReactNode;
}

interface LegalDoc {
  title: string;
  intro: ReactNode;
  sections: LegalSection[];
}

const link = 'font-medium text-saki-400 underline-offset-2 hover:underline';

/** Public Privacy Policy and Terms of Service pages (/privacy, /terms). */
export function LegalPage({ kind }: { kind: LegalKind }) {
  const doc = kind === 'privacy' ? PRIVACY : TERMS;
  const active = useActiveSection(doc.sections.map((s) => s.id));

  return (
    <div className="min-h-full bg-ink-900">
      <header className="sticky top-0 z-20 border-b border-ink-700 bg-ink-900/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:px-6">
          <a href="/" className="flex items-center gap-2.5">
            <SakiLogo size={30} />
            <span className="text-[15px] font-semibold tracking-tight">Saki AI</span>
          </a>
          <div className="ml-auto flex items-center gap-2">
            <a href="/" className="btn-secondary px-3 py-1.5 text-sm">
              <ArrowLeft className="h-4 w-4" />
              Back to Saki
            </a>
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Title area */}
      <div className="relative overflow-hidden border-b border-ink-700">
        <div className="bg-brand-mesh pointer-events-none absolute -top-40 left-1/2 h-72 w-[min(900px,140%)] -translate-x-1/2 opacity-20 blur-3xl" />
        <div className="relative mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
          <nav className="inline-flex rounded-xl border border-ink-700 bg-ink-850 p-1 text-sm" aria-label="Legal documents">
            {(
              [
                ['privacy', 'Privacy Policy'],
                ['terms', 'Terms of Service'],
              ] as const
            ).map(([id, label]) => (
              <a
                key={id}
                href={`/${id}`}
                aria-current={kind === id ? 'page' : undefined}
                className={`rounded-lg px-3.5 py-1.5 font-medium transition ${
                  kind === id ? 'bg-brand text-white shadow-sm' : 'text-ink-300 hover:text-ink-100'
                }`}
              >
                {label}
              </a>
            ))}
          </nav>
          <h1 className="mt-6 text-4xl font-semibold tracking-tight sm:text-5xl">{doc.title}</h1>
          <p className="mt-3 text-sm text-ink-400">Last updated {LAST_UPDATED}</p>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-ink-300">{doc.intro}</p>
        </div>
      </div>

      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[220px_1fr] lg:gap-16">
        {/* Contents */}
        <aside className="hidden lg:block">
          <nav className="sticky top-24" aria-label="On this page">
            <p className="text-xs font-semibold tracking-wider text-ink-400 uppercase">On this page</p>
            <ul className="mt-3 space-y-0.5 border-l border-ink-700">
              {doc.sections.map((section) => (
                <li key={section.id}>
                  <a
                    href={`#${section.id}`}
                    className={`-ml-px block border-l-2 py-1.5 pl-4 text-sm transition ${
                      active === section.id
                        ? 'border-saki-400 font-medium text-ink-100'
                        : 'border-transparent text-ink-400 hover:text-ink-100'
                    }`}
                  >
                    {section.title}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </aside>

        <main className="min-w-0 max-w-3xl">
          {kind === 'privacy' && <PrivacyAtAGlance />}

          {doc.sections.map((section, index) => (
            <section key={section.id} id={section.id} className="scroll-mt-24 border-b border-ink-700 py-8 first:pt-0 last:border-b-0">
              <h2 className="flex items-baseline gap-3 text-xl font-semibold tracking-tight text-ink-100">
                <span className="font-mono text-sm text-saki-400">{String(index + 1).padStart(2, '0')}</span>
                {section.title}
              </h2>
              <div className="legal-body mt-4 space-y-3 text-[15px] leading-7 text-ink-200">{section.body}</div>
            </section>
          ))}

          <div className="mt-6 flex flex-col items-start gap-4 rounded-2xl border border-ink-700 bg-ink-850 p-6 sm:flex-row sm:items-center">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-saki-500/12 text-saki-400">
              <Mail className="h-5 w-5" />
            </span>
            <div className="flex-1">
              <p className="font-semibold text-ink-100">Questions about this {kind === 'privacy' ? 'policy' : 'agreement'}?</p>
              <p className="mt-0.5 text-sm text-ink-400">We are happy to help with any question or request.</p>
            </div>
            <a href={CONTACT_URL} target="_blank" rel="noreferrer" className="btn-primary px-4 py-2">
              Contact us
            </a>
          </div>
        </main>
      </div>

      <footer className="border-t border-ink-700">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-5 gap-y-2 px-4 py-6 text-sm text-ink-400 sm:px-6">
          <span>© {new Date().getFullYear()} Saki AI</span>
          <a href="/privacy" className="hover:text-ink-100">Privacy Policy</a>
          <a href="/terms" className="hover:text-ink-100">Terms of Service</a>
          <a href={CONTACT_URL} target="_blank" rel="noreferrer" className="hover:text-ink-100">Contact</a>
          <a href="/" className="ml-auto inline-flex items-center gap-1.5 font-medium text-ink-200 hover:text-ink-100">
            <ArrowLeft className="h-4 w-4" /> Back to Saki
          </a>
        </div>
      </footer>
    </div>
  );
}

/** The section currently being read, for highlighting it in the contents. */
function useActiveSection(ids: string[]): string {
  const [active, setActive] = useState(ids[0]);
  useEffect(() => {
    const sections = ids.map((id) => document.getElementById(id)).filter((el): el is HTMLElement => el !== null);
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: '-96px 0px -60% 0px' },
    );
    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, [ids]);
  return active;
}

function PrivacyAtAGlance() {
  const points = [
    { icon: Ban, title: 'No selling or ads', text: 'We never sell your data or show advertising.' },
    { icon: MicOff, title: 'Recordings not kept', text: 'Your voice recordings are not stored.' },
    { icon: Trash2, title: 'You are in control', text: 'Delete any chat, or all of them, at any time.' },
  ];
  return (
    <div className="mb-10 grid gap-3 sm:grid-cols-3">
      {points.map(({ icon: Icon, title, text }) => (
        <div key={title} className="rounded-2xl border border-ink-700 bg-ink-850 p-4">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-saki-500/12 text-saki-400">
            <Icon className="h-4 w-4" />
          </span>
          <p className="mt-3 text-sm font-semibold text-ink-100">{title}</p>
          <p className="mt-1 text-sm text-ink-400">{text}</p>
        </div>
      ))}
    </div>
  );
}

const PRIVACY: LegalDoc = {
  title: 'Privacy Policy',
  intro: (
    <>
      Saki AI (“Saki”, “we”) is a voice coding assistant that answers programming questions in Sinhala and English. This
      policy explains what information Saki collects, how it is used and the choices you have.
    </>
  ),
  sections: [
    {
      id: 'information-we-collect',
      title: 'Information we collect',
      body: (
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>Account details:</strong> your name and email address. If you sign up with a password, we store only a
            secure one-way hash of it (BCrypt), never the password itself. If you sign in with Google, we receive your name,
            email address and Google account identifier from Google; we do not receive your Google password.
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
            <strong>Saki’s spoken answers:</strong> the audio of Saki’s answers is saved with your chat so you can play or
            download it again later, and is deleted together with the chat.
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
      ),
    },
    {
      id: 'how-we-use-it',
      title: 'How we use your information',
      body: (
        <>
          <ul className="list-disc space-y-2 pl-5">
            <li>To provide the service: sign you in, answer your questions, speak the answers and keep your chats.</li>
            <li>To keep the service secure: rate limits, preventing abuse and investigating problems.</li>
          </ul>
          <p>
            We do <strong>not</strong> sell your data, show advertising, or use third-party analytics or tracking cookies.
          </p>
        </>
      ),
    },
    {
      id: 'service-providers',
      title: 'Services that process your data',
      body: (
        <>
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
        </>
      ),
    },
    {
      id: 'browser-storage',
      title: 'Storage in your browser',
      body: (
        <p>
          Saki stores your sign-in token and preferences (such as light or dark mode, chat theme, voice and playback speed)
          in your browser’s local storage so you stay signed in. Signing out removes the token. Saki does not use cookies for
          tracking.
        </p>
      ),
    },
    {
      id: 'security',
      title: 'Security',
      body: (
        <p>
          Connections use HTTPS. Passwords are hashed, every chat is only accessible to its owner, and the service applies
          rate limits and strict browser security policies. No online service can be guaranteed to be perfectly secure, but
          we work to protect your information.
        </p>
      ),
    },
    {
      id: 'keeping-and-deleting',
      title: 'Keeping and deleting your data',
      body: (
        <p>
          Your chats are kept until you delete them; deleting a chat removes its messages, code and voices. You can delete
          all chats at once in Settings. To delete your account and all of its data,{' '}
          <a href={CONTACT_URL} target="_blank" rel="noreferrer" className={link}>
            contact us
          </a>{' '}
          and we will remove it.
        </p>
      ),
    },
    {
      id: 'children',
      title: 'Children',
      body: <p>Saki is not directed to children under 13, and we do not knowingly collect their personal information.</p>,
    },
    {
      id: 'changes',
      title: 'Changes to this policy',
      body: <p>We may update this policy; the date at the top shows the latest version.</p>,
    },
  ],
};

const TERMS: LegalDoc = {
  title: 'Terms of Service',
  intro: <>These terms apply to your use of Saki AI (“Saki”). By creating an account or using Saki, you agree to them.</>,
  sections: [
    {
      id: 'the-service',
      title: 'The service',
      body: (
        <p>
          Saki is a free AI assistant that answers programming questions by voice or text and writes example code. It is
          provided “as is”, and features may change or stop at any time. Free hosting means Saki may be slow to start or
          occasionally unavailable.
        </p>
      ),
    },
    {
      id: 'ai-answers',
      title: 'AI answers',
      body: (
        <p>
          Saki uses artificial intelligence and <strong>can make mistakes</strong>. Answers and code may be incomplete,
          insecure or wrong. Review and test anything Saki produces before relying on it; you are responsible for how you use
          it.
        </p>
      ),
    },
    {
      id: 'your-account',
      title: 'Your account',
      body: (
        <ul className="list-disc space-y-2 pl-5">
          <li>Provide accurate information and keep your password secure.</li>
          <li>You are responsible for activity under your account.</li>
        </ul>
      ),
    },
    {
      id: 'acceptable-use',
      title: 'Acceptable use',
      body: (
        <>
          <p>Do not use Saki to:</p>
          <ul className="list-disc space-y-2 pl-5">
            <li>break the law or infringe the rights of others;</li>
            <li>create malware or attack, probe or overload any system, including Saki;</li>
            <li>get around rate limits or security measures, or access other users’ data;</li>
            <li>submit content you do not have the right to share.</li>
          </ul>
          <p>Accounts that misuse the service may be limited or removed.</p>
        </>
      ),
    },
    {
      id: 'your-content',
      title: 'Your content',
      body: (
        <p>
          You keep ownership of the questions and code you submit. You allow Saki to process them only to provide the
          service, as described in the{' '}
          <a href="/privacy" className={link}>
            Privacy Policy
          </a>
          .
        </p>
      ),
    },
    {
      id: 'liability',
      title: 'Limitation of liability',
      body: (
        <p>
          To the extent permitted by law, Saki and its developer are not liable for any loss or damage arising from your use
          of the service or of answers and code it provides.
        </p>
      ),
    },
    {
      id: 'changes',
      title: 'Changes to these terms',
      body: <p>We may update these terms; the date at the top shows the latest version.</p>,
    },
  ],
};
