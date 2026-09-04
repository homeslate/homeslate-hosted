import { Link } from 'react-router-dom';
import { PublicLayout } from './PublicLayout';
import classes from './PrivacyPage.module.css';

export function TermsPage() {
  return (
    <PublicLayout>
      <article className={classes.article}>
        <p className={classes.eyebrow}>Homeslate</p>
        <h1>Terms of Service</h1>
        <p className={classes.updated}>Last updated September 3, 2026</p>
        <p>
          These terms govern use of the hosted Homeslate app at{' '}
          <a href="https://homeslate.dev">homeslate.dev</a>. By signing in or
          using a display, you agree to them. Questions:{' '}
          <a href="mailto:support@homeslate.dev">support@homeslate.dev</a>.
        </p>

        <h2>The service</h2>
        <p>
          Homeslate is a dashboard for screens around a home. You create
          displays, arrange widgets, and optionally connect a Google account so
          calendar and photo widgets can show data you choose. The product is
          provided as-is for personal and household use.
        </p>

        <h2>Your account</h2>
        <p>
          You sign in with Google. You are responsible for the Google account
          you use and for anyone you invite to a display. Do not use Homeslate
          if you cannot agree to Google&apos;s own terms for the Google
          services you connect.
        </p>

        <h2>Acceptable use</h2>
        <p>
          Use Homeslate only for lawful household or personal displays. Do not
          attempt to break into the service, scrape other people&apos;s data,
          or use it to send spam or abuse Google APIs. We may suspend access
          if we need to protect the service or other users.
        </p>

        <h2>Plans and subscriptions</h2>
        <p>
          Homeslate offers a free plan with limited displays and views, and an
          optional paid <strong>Pro</strong> plan with higher limits. Prices,
          billing interval (monthly or annual), and features are shown when you
          upgrade. Payments are processed by{' '}
          <a href="https://stripe.com">Stripe</a>; we do not store your full
          card number.
        </p>
        <p>
          When you subscribe, you authorize recurring charges until you cancel.
          Manage or cancel your subscription anytime from{' '}
          <strong>Manage subscription</strong> in the profile menu (Stripe
          Customer Portal). If you cancel, you typically keep Pro access through
          the end of the current billing period unless Stripe or your Portal
          settings say otherwise. After that, your account returns to the free
          plan and free-tier limits apply again.
        </p>
        <p>
          Fees are generally non-refundable except where required by law. If
          billing fails, we may downgrade your plan or suspend Pro features
          until payment is resolved.
        </p>

        <h2>Your content</h2>
        <p>
          You keep rights to the display layouts, notes, photos, and other
          material you put in Homeslate. You grant us permission to store and
          show that material so the product can work — including on devices you
          pair and for people you invite. How we handle Google user data is in
          the <Link to="/privacy">Privacy Policy</Link>.
        </p>

        <h2>Availability and changes</h2>
        <p>
          We may change, pause, or discontinue features. We do not promise
          uninterrupted uptime. If these terms change, we will update this page
          and the date above. Continued use after that date means you accept
          the updated terms.
        </p>

        <h2>Disclaimer</h2>
        <p>
          Homeslate is provided without warranties of any kind, to the extent
          allowed by law. We are not liable for lost data, missed alarms,
          calendar mistakes, or other damages that come from using or being
          unable to use the service, except where the law does not allow us to
          limit that liability.
        </p>

        <h2>Contact</h2>
        <p>
          The current terms are at{' '}
          <Link to="/terms">homeslate.dev/terms</Link>. Email{' '}
          <a href="mailto:support@homeslate.dev">support@homeslate.dev</a>.
        </p>
      </article>
    </PublicLayout>
  );
}
