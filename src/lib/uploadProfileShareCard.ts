// Profile share card upload — disabled for now (link-only sharing).
//
// import { ref, uploadBytes } from "firebase/storage";
// import { auth, storage } from "./firebase";
//
// /** Upload OG preview card for link unfurling (iMessage, etc.). */
// export async function uploadProfileShareCard(localUri: string): Promise<void> {
//   const user = auth.currentUser;
//   if (!user) throw new Error("Not signed in");
//
//   const response = await fetch(localUri);
//   const blob = await response.blob();
//   const storageRef = ref(storage, `profileShareCards/${user.uid}/card.png`);
//   await uploadBytes(storageRef, blob, {
//     contentType: "image/png",
//     cacheControl: "public,max-age=31536000",
//   });
// }
