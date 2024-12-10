import React, { useState } from 'react';
import { auth, signInWithPhoneNumber, createUserWithEmailAndPassword } from "./firebaseConfig";
import { View, Text, TouchableOpacity, Alert, TextInput } from "react-native";
import { Button } from "../../components/Themed";

interface AuthProps {
    navigation: any;
}

export const CreatePhoneScreen = ({ navigation }: AuthProps) => {
    const [code, setCode] = useState("");
    const [phoneNumber, setPhoneNumber] = useState("");
    const [confirm, setConfirm] = useState<any>(null);
    const [isCodeSent, setIsCodeSent] = useState(false);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [isEmailAuth, setIsEmailAuth] = useState(false);
    const [isLogin, setIsLogin] = useState(false);
    const [countryCode, setCountryCode] = useState("+1");

    const handlePhoneNumberChange = (text: string) => {
        const formattedText = text.replace(/\D/g, "").slice(0, 10);
        setPhoneNumber(formattedText);
    };

    const sendVerificationCode = async () => {
        const formattedPhoneNumber = `${countryCode}${phoneNumber}`;
        try {
            const confirmation = await signInWithPhoneNumber(auth, formattedPhoneNumber);
            setConfirm(confirmation);
            setIsCodeSent(true);
        } catch (error: any) {
            console.log('Error sending code: ', error)
        }
    };

    const verifyCode = async () => {
        try {
            await confirm.confirm(code);
            navigation.navigate("StepTwo");
        } catch (error) {
            Alert.alert("Error", "Incorrect verification code. Please try again.");
        }
    };

    const handleEmailSignUp = async () => {
        if (password !== confirmPassword) {
            Alert.alert("Passwords do not match");
            return;
        }
        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            navigation.navigate("StepTwo", { user: userCredential.user });
        } catch (error: any) {
            Alert.alert("Error", error.message);
        }
    };

    return (
        <View className="flex-1 justify-center">
            <TouchableOpacity
                onPress={() => navigation.navigate("Welcome")}
                style={{ position: "absolute", top: 60, right: 20, zIndex: 3 }}
            >
                <Text style={{ fontSize: 28, color: "white" }}>×</Text>
            </TouchableOpacity>

            <View className='mb-20'>
                {!isEmailAuth ? (
                    <>
                        {!isCodeSent ? (
                            <>
                                <Text style={{ color: "white", fontSize: 32, fontFamily: 'JosefinSans_400Regular', width: 300, marginLeft: 30, marginTop: 90 }}>
                                    What's your phone number?
                                </Text>
                                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 40 }}>
                                    <TextInput
                                        value={countryCode}
                                        editable={true}
                                        onChangeText={setCountryCode}
                                        style={{
                                            color: "white",
                                            backgroundColor: '#333',
                                            paddingVertical: 10,
                                            paddingHorizontal: 15,
                                            borderRadius: 5,
                                            marginLeft: 20,
                                            width: 50,
                                            fontSize: 18,
                                            height: 50,
                                            marginTop: 20

                                        }}
                                    />
                                    <TextInput
                                        value={phoneNumber}
                                        onChangeText={handlePhoneNumberChange}
                                        placeholder="Enter phone number"
                                        className="border-b-4 border-synq-accent-light"
                                        style={{
                                            color: "white",
                                            marginLeft: 10,
                                            width: 260,
                                            paddingVertical: 10,
                                            paddingHorizontal: 15,
                                            backgroundColor: '#333',
                                            borderRadius: 5,
                                            fontSize: 18,
                                            height: 50,
                                            marginTop: 20

                                        }}
                                        keyboardType="phone-pad"
                                    />
                                </View>
                                <Text className="text-white" style={{ fontSize: 12, width: 320, marginLeft: 20, marginTop: 20 }}>
                                    Synq will send you a text with a verification code. Message and data rates may apply.
                                </Text>

                                <TouchableOpacity onPress={sendVerificationCode} style={{ marginTop: 60 }}>
                                    <Button text="Send Code" onPress={sendVerificationCode} style={{ backgroundColor: '#7DFFA6' }} />
                                </TouchableOpacity>
                            </>
                        ) : (
                            <>
                                <Text style={{ color: "white" }}>Enter your verification code</Text>
                                <TextInput
                                    value={code}
                                    onChangeText={setCode}
                                    placeholder="Enter code"
                                    className="border-b-4 border-synq-accent-light"
                                    style={{ color: "white" }}
                                    keyboardType="number-pad"
                                />
                                <TouchableOpacity onPress={verifyCode} className="bg-green-600 px-4 py-2 rounded mt-4">
                                    <Text className="text-white">Confirm Code</Text>
                                </TouchableOpacity>
                            </>
                        )}
                    </>
                ) : (
                    <>
                        <Text style={{ color: "white", fontSize: 32, fontFamily: 'JosefinSans_400Regular', width: 300, marginLeft: 30, marginTop: 90 }}>
                            What's your email?
                        </Text>
                        <TextInput
                            value={email}
                            onChangeText={setEmail}
                            placeholder="Enter email"
                            className="border-b-4 border-synq-accent-light"
                            style={{
                                color: "white",
                                marginLeft: 30,
                                marginTop: 20,
                                width: 300,
                                paddingVertical: 10,
                                paddingHorizontal: 15,
                                backgroundColor: '#333',
                                borderRadius: 5
                            }} />
                        <TextInput
                            value={password}
                            onChangeText={setPassword}
                            placeholder="Enter password"
                            secureTextEntry
                            className="border-b-4 border-synq-accent-light"
                            style={{
                                color: "white",
                                marginLeft: 30,
                                marginTop: 20,
                                width: 300,
                                paddingVertical: 10,
                                paddingHorizontal: 15,
                                backgroundColor: '#333',
                                borderRadius: 5
                            }} />
                        {!isLogin && (
                            <TextInput
                                value={confirmPassword}
                                onChangeText={setConfirmPassword}
                                placeholder="Confirm password"
                                secureTextEntry
                                className="border-b-4 border-synq-accent-light"
                                style={{
                                    color: "white",
                                    marginLeft: 30,
                                    marginTop: 20,
                                    width: 300,
                                    paddingVertical: 10,
                                    paddingHorizontal: 15,
                                    backgroundColor: '#333',
                                    borderRadius: 5
                                }} />
                        )}
                        <TouchableOpacity onPress={handleEmailSignUp} style={{ marginTop: 60 }}>
                            <Button text="Create Account" onPress={handleEmailSignUp} style={{ backgroundColor: '#7DFFA6' }} />
                        </TouchableOpacity>
                    </>
                )}
                <TouchableOpacity onPress={() => setIsEmailAuth(!isEmailAuth)} className="bg-gray-900 px-4 py-2 rounded mt-4" style={{ width: 150, marginLeft: 120, marginTop: 0 }}>
                    <Text className="text-white">{isEmailAuth ? "Switch to Phone" : "Use Email Instead"}</Text>

                </TouchableOpacity>
            </View>
        </View>
    );
};

