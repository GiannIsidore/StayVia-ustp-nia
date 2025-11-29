import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import 'react-native-reanimated';

export default function Index() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/sign-in');
  }, []);

  return null;
}
