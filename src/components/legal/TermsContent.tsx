import React from "react";
import { Text, View } from "react-native";
import { useLegalDocumentParts } from "./useLegalDocumentParts";

export default function TermsContent() {
  const { Section, P, Bullet, styles } = useLegalDocumentParts();

  return (
    <>
      <Section title="1. Acceptance">
        <P>
          These Terms & Conditions govern your use of Synq. By creating an
          account, accessing, or using the app, you agree to these Terms.
        </P>
      </Section>

      <Section title="2. Eligibility">
        <P>
          You must be at least 16 years old to use Synq. If the law where you
          live requires a higher age to use online services without parental
          permission, you may only use Synq with the required consent.
        </P>
      </Section>

      <Section title="3. Accounts">
        <P>
          You may sign up using email/password or a phone number, depending on
          the options we offer. You agree to provide accurate information, keep
          your account details up to date, and keep your login credentials secure.
        </P>
        <P>
          You are responsible for activity that happens through your account. We
          may restrict or suspend accounts that violate these Terms or create
          risk for Synq or other users.
        </P>
      </Section>

      <Section title="4. The Service">
        <P>
          Synq helps people coordinate real-world plans. The app may let you
          create a profile, add interests, set availability, share plans,
          connect with friends, message other users, and receive notifications.
        </P>
        <P>
          Some features depend on optional permissions, such as photo-library
          access for profile photos, push notifications, and foreground
          location for filling in your city, state, and saved coordinates.
          If you decline a permission, some features may not work fully.
        </P>
      </Section>

      <Section title="5. User Content">
        <P>
          You keep ownership of the content you submit to Synq, including your
          profile details, profile photo, interests, status text, plans, and
          messages.
        </P>
        <P>
          You give Synq a limited license to host, store, process, display, and
          transmit that content only as needed to operate the service, including
          showing it to intended recipients, generating notification previews,
          and supporting account and safety workflows.
        </P>
        <P>
          You are responsible for your content and confirm that you have the
          rights needed to share it.
        </P>
      </Section>

      <Section title="6. Community Standards">
        <P>
          Synq has zero tolerance for objectionable content or abusive users.
          You must use Synq respectfully and may not post content or behave in
          ways that harm others or violate these Terms.
        </P>
        <P>
          We provide tools to report and block users. We review reports and aim
          to remove violating content and suspend or ban offending accounts
          within 24 hours of a valid report.
        </P>
      </Section>

      <Section title="7. Acceptable Use">
        <P>Use Synq respectfully. You agree not to:</P>
        <View style={styles.bullets}>
          <Bullet>Harass, bully, threaten, or impersonate others.</Bullet>
          <Bullet>Share unlawful, hateful, exploitative, or sexually explicit content.</Bullet>
          <Bullet>Use Synq to spam, scam, scrape, or solicit people improperly.</Bullet>
          <Bullet>Attempt to access accounts, data, or systems you do not own.</Bullet>
          <Bullet>Interfere with the app, reverse engineer it, or bypass security controls.</Bullet>
          <Bullet>Use the service in a way that violates another person’s privacy or rights.</Bullet>
        </View>
      </Section>

      <Section title="8. Privacy">
        <P>
          Our Privacy Policy explains how Synq handles account information,
          profile information, friend connections, messages, optional location,
          push tokens, and technical/diagnostic data. By using Synq, you also
          acknowledge that Privacy Policy.
        </P>
      </Section>

      <Section title="9. Third-Party Services">
        <P>
          Synq relies on third-party providers to operate features, including
          infrastructure, authentication, storage, notifications, crash/error
          reporting, and place suggestions. Those providers may have their own
          terms and privacy practices.
        </P>
        <P>
          Suggestions generated through mapping or AI-powered features are for
          convenience only and may be incomplete, inaccurate, or unavailable.
        </P>
      </Section>

      <Section title="9. Safety & Real-World Meetups">
        <P>
          Synq is a coordination tool, not a background-check or emergency
          service. We are not responsible for offline interactions between users.
          Use good judgment when meeting people in person.
        </P>
        <View style={styles.bullets}>
          <Bullet>Meet in public places and tell a friend your plans.</Bullet>
          <Bullet>Trust your instincts and leave if you feel unsafe.</Bullet>
        </View>
      </Section>

      <Section title="11. Suspension, Termination, and Deletion">
        <P>
          You may stop using Synq at any time. You may also request deletion of
          your account through the app where available.
        </P>
        <P>
          We may suspend or terminate access if you violate these Terms, if law
          requires us to do so, or if needed to protect Synq, our users, or our
          service providers.
        </P>
      </Section>

      <Section title="11. Disclaimers">
        <P>
          Synq is provided "as is" and "as available" without warranties of any
          kind, to the fullest extent permitted by law. We do not guarantee that
          the app will always be uninterrupted, secure, accurate, or error-free.
        </P>
      </Section>

      <Section title="13. Limitation of Liability">
        <P>
          To the fullest extent permitted by law, Synq will not be liable for
          indirect, incidental, special, consequential, exemplary, or punitive
          damages, or for loss of data, profits, goodwill, or business
          opportunity arising from your use of the app.
        </P>
      </Section>

      <Section title="13. Changes to These Terms">
        <P>
          We may update these Terms from time to time. If we make material
          changes, we will update the "Last updated" date and may also provide
          additional notice inside the app.
        </P>
      </Section>

      <Section title="15. Contact">
        <P>
          Questions about these Terms? Email{" "}
          <Text style={styles.bold}>synqapp@gmail.com</Text>.
        </P>
      </Section>

      <Text style={styles.lastUpdated}>Last updated: May 11, 2026</Text>
      <View style={styles.footerSpace} />
    </>
  );
}
