import { FlatList, ListRenderItemInfo, TouchableOpacity } from 'react-native';
import { User, UserRow, UserStatus } from '../components/UserRow';
import { Button, Text, View } from '../components/Themed';
import * as React from 'react';
import { mockUsers } from '../constants/Mocks';

export default function AddFriendsScreen() {
  const [selected, setSelected] = React.useState<string[]>([]);
  const [invited, setInvited] = React.useState<string[]>([]);

  const onSelectFriend = (id: string) => (selected.includes(id)
    ? setSelected(selected.filter((x) => x !== id))
    : setSelected([...selected, id])
  );

  const sendInvites = () => {
    setInvited([...invited, ...selected]);
    setSelected([]);
  }

  const renderRow = ({ item }: ListRenderItemInfo<User>) => {
    return (
      <TouchableOpacity
        disabled={invited.includes(item.id)}
        onPress={() => onSelectFriend(item.id)}
        className="flex-column mt-4"
      >
        <UserRow user={item} selected={selected.includes(item.id)} invited={invited.includes(item.id)} />
      </TouchableOpacity>
    )
  };

  return (
    <View className='flex-1 items-center pt-8 '>
      <View className='w-5/6 h-full'>
        <Text className="text-xl w-full">Suggested</Text>
        <View className="w-full border-b-2 border-solid border-synq-accent-light dark:border-synq-accent-dark" />
        <FlatList
          className="flex-grow"
          data={mockUsers}
          keyExtractor={(friend) => friend.id}
          renderItem={renderRow}
        />
        {selected?.length > 0 ? <Button text="Add" onPress={() => { sendInvites() }} /> :
          invited?.length > 0 && <Button text="Continue" onPress={() => { }} />
        }
      </View>
    </View>
  );
}