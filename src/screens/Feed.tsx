import { TouchableOpacity, Image, FlatList, ListRenderItemInfo } from "react-native";
import { Button, ScreenView, Text, View } from "../components/Themed";
import * as React from "react";
import clsx from "clsx";
import { mockUsers } from "../constants/Mocks";
import { User } from "../components/UserRow";
import getDistance from "geolib/es/getDistance";
import convertDistance from "geolib/es/convertDistance";

const TabOption = (props: { title: string, selected: boolean, onPress: () => void }) => {
  return (
    <TouchableOpacity onPress={props.onPress}>
      <View className="items-center">
        <Text className={clsx("p-2", props.selected && "text-synq-accent-light")} >{props.title}</Text>
        {props.selected &&
          <View className={"w-3/4 border-b-2 border-solid border-synq-accent-light"} />
        }
      </View>
    </TouchableOpacity>
  )
}

const FeedRow = (props: { user: User, selected: boolean, distanceAway: number }) => {
  return (
    <View className="flex-row justify-between items-center w-full bg-green-400">
      <View className="flex-row w-full">
        <View className="flex-1 pr-5">
          <View className={"absolute flex-1 bg-white w-full h-16 top-2 left-4 rounded-md"} />
          <View className="flex w-20 bg-transparent flex-row items-center">
            <View className="flex bg-transparent w-auto self-start">
              <Image className="flex w-20 h-20 rounded-full" source={props.user?.photoUrl} />
              <Text className="flex text-xs text-center ">{props.user.firstName}</Text>
            </View>
            <Text className="w-52 pb-5 pl-1 text-black text-xs">{props.user.availability.memo}</Text>
            <View className={clsx("absolute bg-white w-6 h-6 top-0 left-0 rounded-full", props.selected && "bg-green-500")} />
          </View>
        </View>
        <View className="flex w-16 mt-4 items-center">
          <Text className="text-xs">{props.distanceAway} mi</Text>
          <Text className="text-xs text-gray-400">00:01:29</Text>
        </View>
      </View>
    </View>
  )
}

interface UserWithDistance extends User {
  distanceAway: number;
}

export function FeedScreen() {
  const tabs = ["Distance", "Name"];
  const [selectedTab, setSelectedTab] = React.useState<string>(tabs[0]);
  const [selected, setSelected] = React.useState<string[]>([]);

  const onSelectFriend = (id: string) => (selected.includes(id)
    ? setSelected(selected.filter((x) => x !== id))
    : setSelected([...selected, id])
  );

  const renderRow = ({ item }: ListRenderItemInfo<UserWithDistance>) => {
    return (
      <TouchableOpacity
        onPress={() => onSelectFriend(item.id)}
        className="flex-column mt-4"
        key={item.id}
      >
        <FeedRow user={item} selected={selected.includes(item.id)} distanceAway={item.distanceAway} />
      </TouchableOpacity>
    )
  };

  const myMockLocation = {
    latitude: 0,
    longitude: 0,
  }

  const getDistanceAway = (user: User) => {
    return Math.floor(convertDistance(getDistance(myMockLocation, user.availability.location), "mi"))
  }

  const usersWithDistance = React.useMemo(() => {
    return mockUsers.map((user: User) => ({ ...user, distanceAway: getDistanceAway(user) }))
  }, [getDistanceAway])

  return (
    <ScreenView className="justify-start pl-4 pr-2 pb-0">
      <View className="mt-10">
        <Text className='text-center text-gray-500'>Sort By</Text>
        <View className="flex-row w-full justify-evenly my-4">
          {tabs.map((tab: string) =>
            <TabOption title={tab} key={tab} selected={selectedTab === tab} onPress={() => setSelectedTab(tab)} />
          )}
        </View>
      </View>
      <FlatList
        data={usersWithDistance.sort((a, b) => selectedTab == "Distance" ? (a.distanceAway > b.distanceAway ? 1 : -1) : a.firstName.localeCompare(b.firstName))}
        keyExtractor={(friend) => friend.id}
        renderItem={(user) => renderRow(user)}
      />
      <Button text="Invite to SYNQ" />
    </ScreenView>
  )
}