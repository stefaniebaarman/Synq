import React from "react";
import { Text, View } from "react-native";
import { useLegalDocumentParts } from "./useLegalDocumentParts";

export default function PrivacyPolicyContent() {
  const { Section, P, Bullet, styles } = useLegalDocumentParts();

  return (
    <>
      <Section title="1. Scope and Contact">
        <P>
          This Privacy Policy describes how Synq ("Synq," "we," "us," or
          "our") collects, uses, stores, and discloses personal information
          when you use the app.
        </P>
        <P>
          Questions, privacy requests, or complaints can be sent to{" "}
          <Text style={styles.bold}>synqapp@gmail.com</Text>.
        </P>
      </Section>

      <Section title="2. Personal Information We Collect">
        <P>
          We collect the categories of personal information below, depending on
          which features you use.
        </P>
        <View style={styles.bullets}>
          <Bullet>
            <Text style={styles.bold}>Identifiers and account credentials:</Text>{" "}
            email address and password if you sign up with email; phone number,
            verification-related data, and reCAPTCHA-based verification flow if
            you sign up with phone; and your authentication user ID.
          </Bullet>
          <Bullet>
            <Text style={styles.bold}>Profile and account content:</Text>{" "}
            display name, first name, last name, optional profile photo,
            interests, city, state, optional saved coordinates, status, memo,
            invite code, timestamps, and plan or event details you add.
          </Bullet>
          <Bullet>
            <Text style={styles.bold}>Social and relationship data:</Text>{" "}
            friends, friend requests, mutual-connection data, invite-link or
            invite-code attribution, Synq counts, and last-Synq timestamps.
          </Bullet>
          <Bullet>
            <Text style={styles.bold}>Communications data:</Text> chat
            participants, participant names and images, message text,
            timestamps, read markers, last-message metadata, and message
            reactions.
          </Bullet>
          <Bullet>
            <Text style={styles.bold}>Notification and device data:</Text>{" "}
            Expo push token, app or device-related metadata needed to send and
            deduplicate notifications, and limited technical information tied
            to app behavior.
          </Bullet>
          <Bullet>
            <Text style={styles.bold}>Feedback and support information:</Text>{" "}
            if you use the feedback flow or email us, we may receive the
            message contents, the optional contact email you provide, and basic
            platform information included in the drafted email.
          </Bullet>
          <Bullet>
            <Text style={styles.bold}>On-device data:</Text> AsyncStorage data
            such as social caches, pending invite information, and local Synq
            status stored on your device to make the app work faster and resume
            correctly.
          </Bullet>
        </View>
      </Section>

      <Section title="3. Sources of Information">
        <P>We collect personal information from the following sources:</P>
        <View style={styles.bullets}>
          <Bullet>Directly from you when you create an account, build your profile, message, add plans, or contact us.</Bullet>
          <Bullet>From your device when you enable permissions like notifications, photo-library access, or foreground location.</Bullet>
          <Bullet>From other users when they send you friend requests, connect with you, or interact with you in chats and shared plans.</Bullet>
          <Bullet>From service providers that help us run Synq, including Firebase, Expo, and Google.</Bullet>
        </View>
      </Section>

      <Section title="4. How We Use Personal Information">
        <P>We use personal information to:</P>
        <View style={styles.bullets}>
          <Bullet>Create, authenticate, and secure accounts.</Bullet>
          <Bullet>Provide profile, friend, availability, plan, and messaging features.</Bullet>
          <Bullet>Show your profile and activity to the users you interact with through Synq.</Bullet>
          <Bullet>Send push notifications about messages, friend requests, accepted requests, plan interest, and friend activity.</Bullet>
          <Bullet>Generate venue suggestions using your city/state and shared interests when you choose that feature.</Bullet>
          <Bullet>Respond to feedback, support, and account requests.</Bullet>
          <Bullet>Prevent abuse, enforce our terms, troubleshoot problems, and maintain app reliability and security.</Bullet>
        </View>
      </Section>

      <Section title="5. Permissions, Location, and Sensitive Data">
        <P>
          Synq does not continuously track your location in the background.
          When you choose to use current location, the app requests foreground
          location permission, reads your coordinates once, reverse geocodes
          them, and stores your city, state, and saved coordinates in your
          profile until you edit or remove them.
        </P>
        <P>
          If you upload a profile photo, Synq requests photo-library access
          only when you choose that action. If you enable push notifications,
          Synq requests notification permission so alerts can be delivered.
        </P>
        <P>
          We use this information only to provide the features you request, not
          for targeted advertising.
        </P>
      </Section>

      <Section title="6. Messages, Notifications, and AI Suggestions">
        <P>
          Messages are stored so chat participants can view them in Synq. We
          also process message contents and metadata to support delivery, unread
          state, reactions, and notification previews.
        </P>
        <P>
          If you use the suggestion feature, Synq sends your selected category,
          your city/state, and shared interests to backend services that call
          Google Generative AI and Google Places APIs to return venue
          suggestions. Those suggestions may be incomplete or inaccurate.
        </P>
      </Section>

      <Section title="7. How We Disclose Personal Information">
        <P>We may disclose personal information in the following ways:</P>
        <View style={styles.bullets}>
          <Bullet>
            <Text style={styles.bold}>To other users:</Text> profile details,
            city/state, availability, plans, friend requests, and messages are
            visible to the people you connect or interact with through Synq.
          </Bullet>
          <Bullet>
            <Text style={styles.bold}>To service providers:</Text> Firebase
            Authentication, Firestore, Storage, and Cloud Functions; Expo
            notifications; Google services used for venue suggestions; and
            your email app/provider when you use the in-app feedback mail flow.
          </Bullet>
          <Bullet>
            <Text style={styles.bold}>For legal, security, or compliance reasons:</Text>{" "}
            when reasonably necessary to comply with law, respond to lawful
            requests, enforce our terms, or protect Synq, our users, or others.
          </Bullet>
          <Bullet>
            <Text style={styles.bold}>In connection with a business transaction:</Text>{" "}
            if Synq is involved in a merger, financing, reorganization, or sale
            of assets, subject to applicable law.
          </Bullet>
        </View>
        <P>
          We do not sell personal information, and we do not share personal
          information for cross-context behavioral advertising based on the
          current app code.
        </P>
      </Section>

      <Section title="8. Retention and Deletion">
        <P>
          We keep personal information for as long as reasonably necessary to
          operate Synq, maintain your account, provide the features you use,
          resolve disputes, and meet legal, tax, accounting, or security
          obligations.
        </P>
        <P>
          If you delete your account through the app, Synq is designed to
          delete your profile document, friends, friend requests,
          notification-lock records, chats, messages, and authentication
          account. Some information may remain temporarily in logs, backups, or
          service-provider systems for a limited period.
        </P>
      </Section>

      <Section title="9. Your Privacy Rights and Choices">
        <P>
          Depending on where you live, you may have rights to access, correct,
          delete, or receive a copy of your personal information, or to object
          to or restrict certain processing.
        </P>
        <P>
          You can already take certain actions inside the app, including
          updating your profile, changing or removing saved location
          information, updating interests, controlling device permissions, and
          deleting your account.
        </P>
        <P>
          To make a privacy request, email{" "}
          <Text style={styles.bold}>synqapp@gmail.com</Text>. We may need to
          verify your identity before completing a request. If we deny a
          request where appeal rights apply, you may reply to that decision and
          ask us to review it again.
        </P>
      </Section>

      <Section title="10. Legal Bases for Processing">
        <P>
          Where applicable law requires a legal basis, we generally process
          personal information based on:
        </P>
        <View style={styles.bullets}>
          <Bullet>Performance of our contract with you to provide the app and its features.</Bullet>
          <Bullet>Your consent for optional permissions and features, such as location, profile-photo access, and notifications.</Bullet>
          <Bullet>Our legitimate interests in operating, securing, improving, and supporting Synq.</Bullet>
          <Bullet>Compliance with legal obligations.</Bullet>
        </View>
      </Section>

      <Section title="11. Children">
        <P>
          Synq is not intended for children under 16. If we learn that we have
          collected personal information from a child who was not permitted to
          use the service, we may delete that information and disable the
          account.
        </P>
      </Section>

      <Section title="12. International Transfers">
        <P>
          Synq and the providers we use may process personal information in
          countries other than the one where you live. By using Synq, you
          understand that your information may be transferred to and processed
          in those locations, subject to applicable law.
        </P>
      </Section>

      <Section title="13. Security">
        <P>
          We use reasonable administrative, technical, and organizational
          measures to protect personal information, but no method of storage or
          transmission is completely secure. We cannot guarantee absolute
          security.
        </P>
      </Section>

      <Section title="14. Changes to This Policy">
        <P>
          We may update this Privacy Policy from time to time. If we make
          material changes, we will update the "Last updated" date and may also
          provide additional notice in the app.
        </P>
      </Section>

      <Section title="15. Contact">
        <P>
          For privacy questions or requests, email{" "}
          <Text style={styles.bold}>synqapp@gmail.com</Text>.
        </P>
      </Section>

      <Text style={styles.lastUpdated}>Last updated: May 11, 2026</Text>
      <View style={styles.footerSpace} />
    </>
  );
}
