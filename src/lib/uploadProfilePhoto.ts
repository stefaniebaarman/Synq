import { doc, setDoc, updateDoc } from "firebase/firestore";
import { getDownloadURL, ref, uploadBytesResumable, deleteObject } from "firebase/storage";
import { auth, db, storage } from "./firebase";

export async function uploadProfilePhoto(localUri: string): Promise<string> {
  const user = auth.currentUser;
  if (!user) throw new Error("Not signed in");

  const response = await fetch(localUri);
  const blob = await response.blob();
  const storageRef = ref(storage, `profiles/${user.uid}`);
  await uploadBytesResumable(storageRef, blob, {
    contentType: "image/jpeg",
    cacheControl: "public,max-age=31536000",
  });
  const url = await getDownloadURL(storageRef);
  await setDoc(doc(db, "users", user.uid), { imageurl: url }, { merge: true });
  return url;
}

export async function removeProfilePhoto(): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error("Not signed in");

  try {
    await deleteObject(ref(storage, `profiles/${user.uid}`));
  } catch {
    // Photo may already be missing.
  }

  await updateDoc(doc(db, "users", user.uid), { imageurl: null });
}
