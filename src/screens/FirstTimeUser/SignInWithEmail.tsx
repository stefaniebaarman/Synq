import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, Alert } from "react-native";
import { auth, signInWithEmailAndPassword } from "./firebaseConfig";
import { Button } from "../../components/Themed";

interface AuthProps {
  navigation: any;
}

export const SignInWithEmail = ({ navigation }: AuthProps) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleEmailLogin = async () => {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      navigation.replace("Returning", { user: userCredential.user });
    } catch (error: any) {
      Alert.alert("Error", error.message);
    }
  };

  return (
    <View className="flex-1 justify-center">
      <TouchableOpacity
        onPress={() => navigation.navigate("Welcome")}
        style={{ position: "absolute", top: 60, right: 30, zIndex: 3 }}
      >
        <Text style={{ fontSize: 24, color: "white" }}>×</Text>
      </TouchableOpacity>
      <View className='w-full items-center'>
        <>

          <Text style={{ color: "white", fontSize: 32, fontFamily: 'JosefinSans_400Regular', width: 300, marginLeft: 30 }}>
            Sign In
          </Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="Enter email"
            className="border-b-4 border-synq-accent-light"
            style={{
              color: "white",
              marginLeft: 10,
              width: 300,
              height: 40,
              paddingVertical: 10,
              paddingHorizontal: 15,
              backgroundColor: '#333',
              borderRadius: 5,
              marginTop: 50
            }}
          />
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="Enter password"
            secureTextEntry
            className="border border-gray-400 p-2 w-full mt-4"
            style={{
              color: "white",
              marginLeft: 10,
              width: 300,
              height: 40,
              paddingVertical: 10,
              paddingHorizontal: 15,
              backgroundColor: '#333',
              borderRadius: 5,
              marginTop: 40
            }}
          />
          <TouchableOpacity onPress={handleEmailLogin} style={{ marginTop: 60 }}>
            <Button text="Sign In" onPress={handleEmailLogin} style={{ backgroundColor: '#7DFFA6' }} />
          </TouchableOpacity>
        </>
      </View>
    </View>
  );
};
