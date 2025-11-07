import { Tabs } from 'expo-router'
import { useColorScheme, Text } from 'react-native'
import { useAuth } from '../../src/contexts/AuthContext'
import { Redirect } from 'expo-router'

export default function TabsLayout() {
  const colorScheme = useColorScheme()
  const { user, loading } = useAuth()

  if (loading) {
    return null
  }

  if (!user) {
    return <Redirect href="/" />
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#FF7E42',
        tabBarInactiveTintColor: '#9CA3AF',
        tabBarStyle: {
          backgroundColor: colorScheme === 'dark' ? '#1F2937' : '#FFFFFF',
          borderTopColor: colorScheme === 'dark' ? '#374151' : '#E5E7EB',
        },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Listen',
          tabBarIcon: ({ color }) => (
            <TabIcon name="list" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: 'Account',
          tabBarIcon: ({ color }) => (
            <TabIcon name="user" color={color} />
          ),
        }}
      />
    </Tabs>
  )
}

// Einfache Tab-Icons mit Emojis (funktioniert überall)
function TabIcon({ name, color }) {
  if (name === 'list') {
    return <Text style={{ fontSize: 20 }}>📋</Text>
  }
  if (name === 'user') {
    return <Text style={{ fontSize: 20 }}>👤</Text>
  }
  return null
}

