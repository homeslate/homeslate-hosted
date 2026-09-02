import { Button } from '@mantine/core';
import { IconBrandGoogle } from '@tabler/icons-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { PublicLayout } from './PublicLayout';
import classes from './HomePage.module.css';

function WallTablet() {
  return (
    <div className={classes.wall} aria-hidden="true">
      <div className={classes.bezel}>
        <div className={classes.screen}>
          <p className={classes.clock}>7:14</p>
          <p className={classes.date}>Tuesday</p>
          <div className={classes.pills}>
            <span>Soccer 4:00</span>
            <span>Trash night</span>
            <span>68° · clear</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function HomePage() {
  const { isAuthenticated, signIn, isLoading } = useAuth();

  return (
    <PublicLayout>
      <section className={classes.hero}>
        <div className={classes.heroCopy}>
          <p className={classes.eyebrow}>Homeslate</p>
          <h1>The slate on the wall.</h1>
          <p className={classes.lead}>
            Homeslate is a dashboard you pin to tablets around the house. Arrange
            widgets once, then leave the screen up in the kitchen, hallway, or
            desk — clock, weather, calendars, photos, news, stocks, alarms, and
            timers, at a glance.
          </p>
          <div className={classes.ctas}>
            {isAuthenticated ? (
              <Button component={Link} to="/displays" size="md" radius="md">
                Open your displays
              </Button>
            ) : (
              <Button
                size="md"
                radius="md"
                leftSection={<IconBrandGoogle size={18} />}
                onClick={signIn}
                loading={isLoading}
              >
                Sign in with Google
              </Button>
            )}
            <Link to="/privacy" className={classes.quietLink}>
              Privacy Policy
            </Link>
          </div>
        </div>
        <WallTablet />
      </section>

      <section className={classes.section} aria-labelledby="what-it-does">
        <h2 id="what-it-does">What it does</h2>
        <ul className={classes.features}>
          <li>
            <strong>Widgets you place yourself.</strong> Clock, weather, Google
            Calendar or any iCal feed, photos, news, stocks, to-dos, sports,
            alarms, and timers. Drag, resize, and save layouts.
          </li>
          <li>
            <strong>Several screens, several views.</strong> A kitchen board, a
            hallway calendar, a desk clock — each display can rotate through
            views you design.
          </li>
          <li>
            <strong>Tablets that just show the board.</strong> Pair a device at{' '}
            <code>/pair</code> so it opens the live display with no keyboard.
          </li>
          <li>
            <strong>Household sharing.</strong> Invite someone to a display so
            the same wall stays in sync.
          </li>
        </ul>
      </section>

      <section className={classes.section} aria-labelledby="google-data">
        <h2 id="google-data">Why Homeslate asks for Google access</h2>
        <p className={classes.googleIntro}>
          Signing in with Google is how you create a Homeslate account and
          connect the widgets that read Google data. We request only what those
          features need:
        </p>
        <dl className={classes.scopes}>
          <div>
            <dt>Google account (name, email, profile photo)</dt>
            <dd>
              Identifies you so we can attach the displays you own, invitations
              you send, and the person currently signed in. We do not use your
              Google account to post, email, or contact people for you.
            </dd>
          </div>
          <div>
            <dt>Google Calendar</dt>
            <dd>
              Reads the calendars you choose so Calendar widgets can show upcoming
              events on your wall displays, and lets you create, edit, or delete
              events from the display. We store a refresh token on our servers so
              a registered display can keep fetching events after you close the
              browser you signed in on. We do not sell calendar data or use it for
              advertising.
            </dd>
          </div>
          <div>
            <dt>Google Photos Picker</dt>
            <dd>
              Opens Google&apos;s photo picker so you can choose specific photos
              for a widget or background. We copy the photos you pick into
              Homeslate storage and show them on your displays. We cannot
              browse your full library — only items you select in the picker.
            </dd>
          </div>
        </dl>
        <p>
          You can disconnect Homeslate from{' '}
          <a href="https://myaccount.google.com/permissions">
            Google Account permissions
          </a>
          . How we store this data is in the{' '}
          <Link to="/privacy">Privacy Policy</Link>.
        </p>
      </section>
    </PublicLayout>
  );
}
