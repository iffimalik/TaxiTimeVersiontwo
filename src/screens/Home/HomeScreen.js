  import React, { useState, useEffect } from 'react';
  import {
    Text,
    StyleSheet,
    TouchableOpacity,
    StatusBar,
    Alert,
    View,
    FlatList,
    SafeAreaView,
    ActivityIndicator,
    RefreshControl,
    ScrollView,
  } from 'react-native';
  import NetInfo from '@react-native-community/netinfo';
  import Ionicons from 'react-native-vector-icons/Ionicons';
  import auth from '@react-native-firebase/auth';
  import useJobStore from '../../store/jobStore'; // adjust path as needed
  import NetworkBanner from './NetworkBanner';
  import ShiftOverview from './HomeComponent/ShiftOverview';
  import { useNavigation } from '@react-navigation/native';

  import { useContext } from 'react';
  import { ShiftContext } from '../../context/ShiftContext'; // adjust path as needed
import { stopService  , startService} from './../../BackgroundService';
 
import useLocationStore from '../../store/locationStore'; // adjust path as needed
import LocationDisplay from './HomeComponent/LocationDisplay';
import CurrentAddress from './HomeComponent/CurrentAddress';
 


  const HomeScreen = ({ navigation }) => {
    const [logoutLoading, setLogoutLoading] = useState(false);
    const [previousJobsVisible, setPreviousJobsVisible] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
  const { shiftStarted, shiftStartTime, shiftCloseTime, endShift } = useContext(ShiftContext);
      const { selectedVehicle } = useContext(ShiftContext); // Get selected vehicle from context
      const [vehicle, setVehicle] = useState(selectedVehicle || null);
    const [shiftStartedState, setShiftStartedState] = useState(shiftStarted || false);
    const [isShiftStarted, setIsShiftStarted] = useState(shiftStarted); // or false initially
    const [activeJob, setActiveJob] = useState({
      id: 'trip123',
      destination: 'Education City',
      startedAt: '2h 10m ago',
      earningsSoFar: 'QAR 120',
      destinationLat: 25.274188294053577,
      destinationLng: 51.5455120537612,  
        
    });
    // const [activeJob, setActiveJob] = useState(null);
    const { currentJob, setCurrentJob, setJobStatus, clearJob } = useJobStore();

    const [upcomingJob, setUpcomingJob] = useState(null);

    const [availableJobs, setAvailableJobs] = useState([
      { id: 'a1', destination: 'Souq Waqif', details: 'Pickup at 4pm', earning: 'QAR 100' ,destinationLat: 25.274188294053577,
      destinationLng: 51.5455120537612,},
      { id: 'a2', destination: 'Hamad Intl Airport', details: 'Pickup at 5pm', earning: 'QAR 140' ,destinationLat: 25.274188294053577,
      destinationLng: 51.5455120537612,},
      { id: 'a3', destination: 'Aspire Zone', details: 'Pickup at 6pm', earning: 'QAR 110' ,destinationLat: 25.274188294053577,
      destinationLng: 51.5455120537612,  },
      { id: 'a4', destination: 'Aspire Zone', details: 'Pickup at 6pm', earning: 'QAR 110' ,destinationLat: 25.274188294053577,
      destinationLng: 51.5455120537612,},
      { id: 'a5', destination: 'Aspire Zone', details: 'Pickup at 6pm', earning: 'QAR 110' ,destinationLat: 25.274188294053577,
      destinationLng: 51.5455120537612,},
            
    ]);
    // const [availableJobs, setAvailableJobs] = useState(null);
    const mockPreviousJobs = [
      { id: '1', destination: 'West Bay', earnings: 'QAR 300', date: '2025-05-20' ,destinationLat: 25.274188294053577,
      destinationLng: 51.5455120537612,},
      { id: '2', destination: 'The Pearl', earnings: 'QAR 150', date: '2025-05-19' ,destinationLat: 25.274188294053577,
      destinationLng: 51.5455120537612,},
      { id: '3', destination: 'Lusail', earnings: 'QAR 250', date: '2025-05-18' ,destinationLat: 25.274188294053577,
      destinationLng: 51.5455120537612,},
    ];
    const simulateJob = () => {
  const fakeJob = {
    id: 'JOB-2025-001',
    pickupLocation: 'City Center Mall, Doha',
    dropoffLocation: 'Education City, Al Rayyan',
    pickupLat: 25.276987,
    pickupLng: 51.520008,
    dropoffLat: 25.319860,
    dropoffLng: 51.437540,
    riderName: 'Ahmed Al Thani',
    riderPhone: '+974 5512 3412',
    estimatedFare: 'QAR 120.00',
    status: 'on_the_way', // could be: pending, accepted, on_the_way, arrived, started, completed
    distance: '18.4 km',
    estimatedDuration: '25 mins',
    vehicle: {
      type: 'Sedan',
      plate: 'QAT-54321',
      color: 'White',
      model: 'Toyota Camry 2022'
    },
    pickupTime: '2025-05-25T15:00:00+03:00',
    assignedAt: '2025-05-25T14:45:00+03:00',
    notes: 'Customer has luggage. Assist if needed.',
  };

  setCurrentJob(fakeJob);
};


    
    const handleAccept = () => {
      setJobStatus('accepted');
      navigation.navigate('JobTrackingScreen');
    };

    const handleReject = () => {
      clearJob();
    };
    const [latitude, setLatitude] = useState(null);
    const [longitude, setLongitude] = useState(null);
    useEffect(() => {


          const checkAndStartService = async () => {
            const { isBackgroundServiceRunning, latitude, longitude, } = useLocationStore.getState();
          
          
            if (!isBackgroundServiceRunning) {
              console.log('Service was not running — starting now...');
              await startService();
            }
          };

          checkAndStartService();

      const unsubscribe = NetInfo.addEventListener(state => {});
      return () => unsubscribe();

  
    }, []);

    const handleLogout = async () => {
      Alert.alert('Logout', 'Are you sure you want to logout?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            setLogoutLoading(true);
            try {
              await auth().signOut();
            } catch (e) {
              Alert.alert('Error', 'Logout failed, please try again.');
            }
            setLogoutLoading(false);
          },
        },
      ]);
    };

    const onRefresh = () => {
      setRefreshing(true);
      setTimeout(() => setRefreshing(false), 1500);
    };


    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor="#f7f9fc" />
        {/* <View style={styles.header}>
          <Text style={styles.title}>Driver Dashboard</Text>
          <TouchableOpacity onPress={handleLogout} disabled={logoutLoading}>
            {logoutLoading ? (
              <ActivityIndicator size="small" color="#2f80ed" />
            ) : (
              <Ionicons name="log-out-outline" size={28} color="#2f80ed" />
            )}
          </TouchableOpacity>
        </View> */}
        <View style={styles.header}>
          <Text style={styles.title}>Driver Dashboard</Text>
          <LocationDisplay />
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      {isShiftStarted ? (
        // Show Shift Close button with confirmation
        <TouchableOpacity
          onPress={() => {
            Alert.alert(
              'Confirm Shift Close',
              'Are you sure you want to close your shift?',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Yes',
                  onPress: () => {
                    Alert.alert('Shift Closed', 'You have successfully closed your shift.');
                    stopService();
                    endShift(); // clears context + AsyncStorage
                    setIsShiftStarted(false); // local state
                    setVehicle(null); // reset vehicle UI if needed
                  
                  },
                },
              ],
              { cancelable: true }
            );
          }}
          style={{ marginRight: 8, alignItems: 'center' }}
        >
          <Ionicons name="checkmark-done-outline" size={26} color="#27ae60" />
          <Text style={{ fontSize: 10, color: '#27ae60' }}>Close Shift</Text>
        </TouchableOpacity>
      ) : (
        // Show Logout button
        <TouchableOpacity onPress={handleLogout} disabled={logoutLoading}>
          {logoutLoading ? (
            <ActivityIndicator size="small" color="#2f80ed" />
          ) : (
            <Ionicons name="log-out-outline" size={28} color="#2f80ed" />
          )}
          <Text style={{ fontSize: 10, color: '#2f80ed' }}>Logout</Text>
        </TouchableOpacity>
      )}
    </View>
  </View>


        <NetworkBanner />
        <CurrentAddress style={{
              backgroundColor: '#2f80ed',
              padding: 14,
              margin: 12,
          borderRadius: 10,
              marginBottom: "100%",
              alignItems: 'center',
            }}/>
       
            
        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          {/* Top Cards */}
          <View style={styles.cardRow}>
            <View style={styles.card}>
              <Ionicons name="location-outline" size={26} color="#2f80ed" />
           
              <Text style={styles.cardLabel}>Next Destination</Text>
              <Text style={styles.cardValue}>Al Sadd, Doha</Text>
            </View>
            <View style={styles.card}>
              <Ionicons name="checkmark-done-circle-outline" size={26} color="#2f80ed" />
              <Text style={styles.cardLabel}>Trips Today</Text>
              <Text style={styles.cardValue}>3 Completed</Text>
            </View>
          </View>
          <TouchableOpacity
                  style={styles.startJobButton}
            onPress={() => {
              simulateJob();        // Set the dummy job
              setJobStatus('started'); // Mark as started (optional, based on your flow)
              // navigation.navigate('JobTrackingScreen'); // Navigate to tracking screen
            }}
            
          >
             <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>
              Start Dummy Job
            </Text>  
          </TouchableOpacity>
          {/* Overview */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Today’s Overview</Text>
            <View style={styles.overviewRow } >
              <View style={[styles.overviewItem, styles.card1]}>
                <Text style={styles.overviewValue}>12</Text>
                <Text style={styles.overviewLabel}>Stops</Text>
              </View>
              {/* <View style={[styles.overviewItem, styles.card1]}>
                <Text style={styles.overviewValue}>5h 20m</Text>
                <Text style={styles.overviewLabel}>Drive Time</Text>
              </View> */}
              <ShiftOverview/>
              <View style={[styles.overviewItem, styles.card1]}>
                <Text style={styles.overviewValue}>QAR 420</Text>
                <Text style={styles.overviewLabel}>Earnings</Text>
              </View>
            </View>
          </View>

          {/* Active Job */}
          {activeJob && (
            <TouchableOpacity
              style={styles.activeJobSection}
              onPress={() => navigation.navigate('JobTrackingScreen', { job: activeJob })}
            >
              <Text style={styles.activeJobTitle}>Active Trip</Text>
              <View style={styles.activeJobDetails}>
                <Ionicons name="navigate-outline" size={24} color="#2f80ed" />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.activeJobDestination}>{activeJob.destination}</Text>
                  <Text style={styles.activeJobSubtext}>
                    Started: {activeJob.startedAt} | Earnings: {activeJob.earningsSoFar}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.endTripButton}
                  onPress={() => Alert.alert('End Trip', 'Feature to end trip coming soon!')}
                >
                  <Text style={styles.endTripButtonText}>End Trip</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          )}
          {!activeJob &&
            <>
            <View style={{ marginHorizontal: 16, marginTop: 20 }}>
              <TouchableOpacity
                style={styles.startJobButton}
                onPress={() => {
                  navigation.navigate('CreateJobScreen'); // or your job creation handler
                }}
              >
                <Text style={styles.startJobButtonText}>Start a New Job</Text>
              </TouchableOpacity>
            </View>
            </>
          }
        

          {/* Upcoming Job */}
          {upcomingJob && (
            <View style={styles.activeJobSection}>
              <Text style={styles.activeJobTitle}>Upcoming Trip</Text>
              <View style={styles.activeJobDetails}>
                <Ionicons name="time-outline" size={24} color="#f39c12" />
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.activeJobDestination}>{upcomingJob.destination}</Text>
                  <Text style={styles.activeJobSubtext}>{upcomingJob.details} | {upcomingJob.earning}</Text>
                </View>
                <TouchableOpacity
                  style={styles.endTripButton}
                  onPress={() => {
                    setActiveJob(upcomingJob);
                    setUpcomingJob(null);
                  }}
                >
                  <Text style={styles.endTripButtonText}>Start</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Available Jobs */}
          {availableJobs?.length > 0 && (
            <>
              <View style={styles.previousJobsSection}>
            <Text style={styles.previousJobsTitle}>Available Jobs</Text>
            <FlatList
              data={availableJobs}
              keyExtractor={item => item.id}
              scrollEnabled={false}
              renderItem={({ item }) => (
                <View style={styles.previousJobItem}>
                  <Text style={styles.jobDestination}>{item.destination}</Text>
                  <Text style={styles.jobDetails}>{item.details} — {item.earning}</Text>
                  <TouchableOpacity
                    style={styles.queTripButton}
                    onPress={() => {
                      if (upcomingJob) {
                        Alert.alert(
                          'Replace Upcoming Job?',
                          'You already have an upcoming job. Replace it?',
                          [
                            { text: 'Cancel', style: 'cancel' },
                            {
                              text: 'Replace',
                              style: 'destructive',
                              onPress: () => {
                                setUpcomingJob(item);
                                setAvailableJobs(prev => prev.filter(job => job.id !== item.id));
                                Alert.alert('Updated', 'Upcoming job replaced.');
                              }
                            }
                          ]
                        );
                      } else {
                        setUpcomingJob(item);
                        setAvailableJobs(prev => prev.filter(job => job.id !== item.id));
                        Alert.alert('Success', 'You accepted a new upcoming job.');
                      }
                    }}
                  >
                    <Text style={styles.endTripButtonText}>Pick</Text>
                  </TouchableOpacity>
                </View>
              )}
            />
                </View>
            </>
          )}
          {/* Previous Jobs */}
            {mockPreviousJobs.length > 0 && (
              <View style={styles.previousJobsSection}>
                <Text style={styles.previousJobsTitle}>Previous Jobs</Text>
                {mockPreviousJobs.map(job => (
                  <View key={job.id} style={styles.previousJobItem}>
                    <Text style={styles.jobDestination}>{job.destination}</Text>
                    <Text style={styles.jobDetails}>
                      {job.date} — {job.earnings}
                    </Text>
                  </View>
                ))}
              </View>
            )}
        </ScrollView>
      </SafeAreaView>
    );
  };

  const styles = StyleSheet.create({
    safeArea: {
      flex: 1,
      marginTop: StatusBar.currentHeight,
      backgroundColor: '#f7f9fc'
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      padding: 16,
      alignItems: 'center',
      backgroundColor: '#fff',
    },
    title: { fontSize: 20, fontWeight: 'bold', color: '#2f80ed' },
    scrollContainer: { padding: 16 },
    cardRow: { flexDirection: 'row', justifyContent: 'space-between' },
    card: {
      width: '48%',
      backgroundColor: '#fff',
      padding: 16,
      borderRadius: 12,
      alignItems: 'center',
      elevation: 2,
    },
    card1: {
      width: '28%',
      margin:3,
      backgroundColor: '#fff',
      padding: 10,
      borderRadius: 12,
      alignItems: 'center',
      elevation: 1,
    },
    cardLabel: { fontSize: 14, color: '#888', marginTop: 8 },
    cardValue: { fontSize: 16, fontWeight: 'bold', color: '#333', marginTop: 4 },
    section: { marginTop: 24 },
    sectionTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 12, color: '#333' },
    overviewRow: { flexDirection: 'row', justifyContent: 'space-between' },
    overviewItem: { alignItems: 'center' , flex: 1 },
    overviewValue: { fontSize: 16, fontWeight: 'bold', color: '#333' },
    overviewLabel: { fontSize: 12, color: '#777' },
    activeJobSection: { marginTop: 24 },
    activeJobTitle: { fontSize: 18, fontWeight: 'bold', color: '#333', marginBottom: 8 },
    activeJobDetails: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#fff',
      padding: 16,
      borderRadius: 12,
      elevation: 2,
    },
    activeJobDestination: { fontSize: 16, fontWeight: 'bold', color: '#2f80ed' },
    activeJobSubtext: { fontSize: 12, color: '#555', marginTop: 4 },
    endTripButton: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      backgroundColor: '#2f80ed',
      borderRadius: 8,
    },
    queTripButton: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      backgroundColor:'rgb(188, 36, 31)',//accept job color
      borderRadius: 8,
    },
    endTripButtonText: { color: '#fff', fontWeight: 'bold' },
    previousJobsSection: { marginTop: 24 },
    previousJobsTitle: { fontSize: 18, fontWeight: 'bold', color: '#333', marginBottom: 12 },
    previousJobItem: {
      backgroundColor: '#fff',
      padding: 16,
      borderRadius: 12,
      marginBottom: 12,
      elevation: 2,
    },
    jobDestination: { fontSize: 16, fontWeight: 'bold', color: '#333' },
    jobDetails: { fontSize: 12, color: '#555', marginVertical: 4 },
    startJobButton: {
    backgroundColor: '#2f80ed',
    paddingVertical: 14,
    borderRadius: 8,
      alignItems: 'center',
    marginVertical: 16,
    marginHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
    flexDirection: 'row',
    alignItems: 'center', 
    justifyContent: 'center',
  },

  startJobButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },

  });

  export default HomeScreen;
