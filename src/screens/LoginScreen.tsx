import * as React from 'react';
import { View, Text, StyleSheet, Button } from 'react-native';
import jwtDecode from 'jwt-decode';
import axios from 'axios';
import PublicClientApplication from 'react-native-msal';
import type { MSALConfiguration } from 'react-native-msal';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { revokeAsync, RevokeTokenRequest } from 'expo-auth-session';

interface GoogleUser {
  error?: unknown;
  email?: string;
  family_name?: string; // Last name
  given_name?: string; // First name
  id?: string;
  locale?: string;
  name?: string; // Full name
  picture?: string; // Photo url
  verified_email?: boolean;
};


// TODO: make these env variables 
// Following env vars are from Azure AD page 
const clientId = "123"; // From app registration tab 
const clientSecret = "123"; // From Certificates & Secrets tab within app Synq's app registration 
const tenantId = "123"; // From Overview tab 

// From Google Cloud OAuth client
const googleClientID = "123";
const googleClientSecret = "123"

const azureConfig: MSALConfiguration = {
  auth: {
    clientId,
    redirectUri: "synqapp://auth"
  },
};

WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  const [accessToken, setAccessToken] = React.useState<string | null>();
  const [userInfo, setUserInfo] = React.useState<GoogleUser>();

  // Initialize the Google Sign-In configuration
  const [request, response, promptAsync] = Google.useAuthRequest({
    expoClientId: googleClientID,
    webClientId: googleClientID,
    iosClientId: googleClientID,
    androidClientId: googleClientID
  })

  React.useEffect(() => {
    if (response?.type === "success") {
      setAccessToken(response.authentication?.accessToken);
      getUserInfo(response.authentication?.accessToken as string);
    }
  }, [response, accessToken]);

  // Initialize Azure AD public client app
  const msalInstance = new PublicClientApplication(azureConfig);

  // Handle Azure AD auth flow
  async function authenticateWithAzureAD(idToken: any) {
    try {
      // Authenticate the user with Azure AD using the ID token from Google
      const response = await msalInstance.acquireToken({
        scopes: ["openid", "profile", "User.Read"],
        extraScopesToConsent: [idToken],
      });

      // Access the access token for the authenticated user
      const accessToken = response?.accessToken;

      // You can now use the access token to make requests to Microsoft Graph API or other protected resources
    } catch (error) {
    }
  }

  const getUserInfo = async (token: string) => {
    try {
      const result = await fetch(
        "https://www.googleapis.com/userinfo/v2/me",
        {
          headers: { Authorization: `Bearer ${token}` },
        })
      const user: GoogleUser = await result.json();
      if (user.error) {
        throw user.error;
      }
      setUserInfo(user);
      //authenticateWithAzureAD(idToken);
    } catch (error: any) {
      console.error("From 1", error);
    }
  }

  return (
    <View style={styles.container}>
      {userInfo ? (
        <>
          <Text style={styles.text}>Welcome {userInfo.given_name}!</Text>
          <Text style={styles.text}>Email: {userInfo.email}</Text>
        </>
      ) : (
        <Button
          title="Google"
          disabled={!request}
          onPress={() => { promptAsync() }}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
});