import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { storage } from "./firebase";
import {
  prepareCommunityCoverPhoto,
  prepareCommunityCoverThumb,
} from "./prepareCommunityCoverPhoto";

export type CommunityCoverUploadResult = {
  coverPhotoUrl: string;
  coverPhotoThumbUrl: string;
};

async function uploadCoverBlob(storagePath: string, blob: Blob): Promise<string> {
  const storageRef = ref(storage, storagePath);
  await uploadBytes(storageRef, blob, {
    contentType: "image/jpeg",
    cacheControl: "public,max-age=31536000",
  });
  return getDownloadURL(storageRef);
}

export async function uploadCommunityCoverPhoto(
  groupId: string,
  localUri: string
): Promise<CommunityCoverUploadResult> {
  const preparedUri = await prepareCommunityCoverPhoto(localUri);
  const thumbUri = await prepareCommunityCoverThumb(preparedUri);

  const [coverBlob, thumbBlob] = await Promise.all([
    fetch(preparedUri).then((response) => response.blob()),
    fetch(thumbUri).then((response) => response.blob()),
  ]);

  const basePath = `communityCovers/${groupId}`;
  const [coverPhotoUrl, coverPhotoThumbUrl] = await Promise.all([
    uploadCoverBlob(`${basePath}/cover.jpg`, coverBlob),
    uploadCoverBlob(`${basePath}/thumb.jpg`, thumbBlob),
  ]);

  return { coverPhotoUrl, coverPhotoThumbUrl };
}
