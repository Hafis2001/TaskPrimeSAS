import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors } from '../../constants/theme';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error) {
        // Update state so the next render will show the fallback UI.
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        // You can also log the error to an error reporting service
        console.error("Uncaught Error:", error, errorInfo);
        this.setState({ errorInfo });
    }

    handleRestart = () => {
        // Simple reset of state to try to re-render children
        // If the error is persistent in the component tree, it might crash again immediately, but this is a safe fallback.
        console.log("Reloading app via ErrorBoundary Reset...");
        this.setState({ hasError: false, error: null, errorInfo: null });
    }

    render() {
        if (this.state.hasError) {
            // You can render any custom fallback UI
            return (
                <SafeAreaView style={styles.container}>
                    <View style={styles.content}>
                        <Ionicons name="alert-circle" size={80} color={Colors.error.main} />
                        <Text style={styles.title}>Oops! Something went wrong.</Text>
                        <Text style={styles.subtitle}>
                            We encountered an unexpected error. The app has been paused to prevent data loss.
                        </Text>

                        <View style={styles.errorBox}>
                            <ScrollView>
                                <Text style={styles.errorText}>
                                    {this.state.error && this.state.error.toString()}
                                </Text>
                            </ScrollView>
                        </View>

                        <TouchableOpacity style={styles.button} onPress={this.handleRestart}>
                            <Text style={styles.buttonText}>Try Again</Text>
                        </TouchableOpacity>
                    </View>
                </SafeAreaView>
            );
        }

        return this.props.children;
    }
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
        justifyContent: 'center',
        alignItems: 'center',
    },
    content: {
        padding: 24,
        width: '100%',
        alignItems: 'center', // Center content horizontally
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#333',
        marginTop: 16,
        marginBottom: 8,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 16,
        color: '#666',
        textAlign: 'center',
        marginBottom: 24,
    },
    errorBox: {
        backgroundColor: '#f5f5f5',
        padding: 12,
        borderRadius: 8,
        marginBottom: 24,
        width: '100%',
        maxHeight: 200,
        borderWidth: 1,
        borderColor: '#e0e0e0',
    },
    errorText: {
        color: Colors.error.main,
        fontFamily: 'monospace',
        fontSize: 12,
    },
    button: {
        backgroundColor: Colors.primary.main,
        paddingVertical: 14,
        paddingHorizontal: 32,
        borderRadius: 8,
        elevation: 2,
    },
    buttonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
});

export default ErrorBoundary;
