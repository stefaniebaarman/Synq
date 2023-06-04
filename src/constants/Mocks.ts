import { ChatPreviewRowProps } from "../components/ChatPreviewRow";
import { User, UserStatus } from "../components/UserRow";

export const mockKevinUser: User = { id: "kevk11", firstName: "Kevin", lastName: "Kim", photoUrl: { uri: "https://images.unsplash.com/photo-1543610892-0b1f7e6d8ac1?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=987&q=80" }, availability: { status: UserStatus.Available, location: { latitude: 0.5, longitude: 0 }, memo: "Grabbin a quick iced coffee!" } }

export const mockMonaUser: User = { id: "msinclair", firstName: "Mona", lastName: "Sinclair", photoUrl: { uri: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=1887&q=80" }, availability: { status: UserStatus.Available, location: { latitude: 0.11, longitude: 0.1 }, memo: "Running some errands at Target and Home Depot :)" } }

export const mockCameronUser: User = { id: "camgreene", firstName: "Cameron", lastName: "Greene", photoUrl: { uri: "https://images.unsplash.com/photo-1611703372231-02ffff8abee6?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=986&q=80" }, availability: { status: UserStatus.Available, location: { latitude: 4, longitude: 10 }, memo: "Gonna check out the new exhibit at the Art Institute" } }

export const mockUsers: User[] = [
  mockKevinUser,
  mockMonaUser,
  mockCameronUser
]

export const mockChats: ChatPreviewRowProps[] = [{ id: "chat1", users: mockUsers, messages: [{ sender: mockMonaUser, text: "Thoughts on heading to Oak St beach?", id: "ChatMona1" }, { sender: mockKevinUser, text: "I'm so down!", id: "ChatKevin1" }, { sender: mockMonaUser, text: "Great. I'll start getting ready.", id: "ChatMona2" }] }, { id: "chat2", users: [mockCameronUser], messages: [{ sender: mockCameronUser, text: "Wanna join my other plan?", id: "ChatCameron1" }] }]