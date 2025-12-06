import { Link, Tabs } from "expo-router";
import React from "react";
import { Ionicons } from '@expo/vector-icons';

export default function TabsLayout(){
    return (
      <Tabs screenOptions={{headerShown: false}}>
        <Tabs.Screen
        name="[id]"
        options={{
          title: "",
      tabBarStyle: { display: "none" },
        }}
      />
       
        
    </Tabs>
    )
}
