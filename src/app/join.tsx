import { Redirect, useLocalSearchParams } from 'expo-router';
export default function JoinRoute() {
  const { code } = useLocalSearchParams<{ code?: string }>();
  return <Redirect href={{ pathname: '/', params: { code: code ?? '' } }} />;
}
