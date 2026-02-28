import { StyleSheet } from 'react-native';

export default StyleSheet.create({
  container: { flex: 1, justifyContent: 'flex-start', padding: 20, backgroundColor: '#f5f5f5' },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
  subtitle: { fontSize: 18, fontWeight: '600', marginTop: 20, marginBottom: 10 },
  form: { marginBottom: 20 },
  input: { height: 40, borderColor: '#ccc', borderWidth: 1, marginBottom: 10, paddingLeft: 10, borderRadius: 5 },
  buttonContainer: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  ride: { backgroundColor: '#fff', padding: 10, marginBottom: 10, borderRadius: 5, borderWidth: 1, borderColor: '#ddd' },
});
