/**
 * Authentication Module - The Litmus
 * Handles user sign in/out and auth state
 */

// Current user state
let currentUser = null;

// Auth state change listeners
const authListeners = [];

/**
 * Initialize auth and set up listeners
 */
function initAuth() {
    auth.onAuthStateChanged(async (user) => {
        currentUser = user;
        
        if (user) {
            console.log('[Auth] User signed in:', user.email);
            // Load user data from Firestore
            await loadUserData(user.uid);
            updateAuthUI(true, user);
        } else {
            console.log('[Auth] User signed out');
            updateAuthUI(false, null);
        }
        
        // Notify all listeners
        authListeners.forEach(listener => listener(user));
    });
}

/**
 * Sign in with Google
 */
async function signInWithGoogle() {
    try {
        showAuthLoading(true);
        const result = await auth.signInWithPopup(googleProvider);
        console.log('[Auth] Google sign-in successful');
        
        // Check if new user, create profile
        if (result.additionalUserInfo?.isNewUser) {
            await createUserProfile(result.user);
        }
        
        closeAuthModal();
        return result.user;
    } catch (error) {
        console.error('[Auth] Google sign-in error:', error);
        showAuthError(getErrorMessage(error));
        return null;
    } finally {
        showAuthLoading(false);
    }
}

/**
 * Sign in with Apple
 */
async function signInWithApple() {
    try {
        showAuthLoading(true);
        const result = await auth.signInWithPopup(appleProvider);
        console.log('[Auth] Apple sign-in successful');
        
        // Check if new user, create profile
        if (result.additionalUserInfo?.isNewUser) {
            await createUserProfile(result.user);
        }
        
        closeAuthModal();
        return result.user;
    } catch (error) {
        console.error('[Auth] Apple sign-in error:', error);
        showAuthError(getErrorMessage(error));
        return null;
    } finally {
        showAuthLoading(false);
    }
}

/**
 * Sign out
 */
async function signOut() {
    try {
        await auth.signOut();
        console.log('[Auth] Signed out successfully');
        // Clear synced data, keep localStorage as fallback
    } catch (error) {
        console.error('[Auth] Sign out error:', error);
    }
}

/**
 * Create user profile in Firestore
 */
async function createUserProfile(user) {
    const userRef = db.collection('users').doc(user.uid);
    
    // Get existing localStorage data to migrate
    const localCoins = JSON.parse(localStorage.getItem('litmus_focus_coins') || '[]');
    const localRegion = localStorage.getItem('litmus_region') || 'americas';
    
    const profile = {
        email: user.email,
        displayName: user.displayName || '',
        photoURL: user.photoURL || '',
        focusCoins: localCoins.length > 0 ? localCoins : ['BTC', 'ETH'],
        region: localRegion,
        accountType: 'free',
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    await userRef.set(profile);
    console.log('[Auth] User profile created');
    
    return profile;
}

/**
 * Get current user
 */
function getCurrentUser() {
    return currentUser;
}

/**
 * Check if user is signed in
 */
function isSignedIn() {
    return currentUser !== null;
}

/**
 * Add auth state listener
 */
function onAuthStateChange(callback) {
    authListeners.push(callback);
    // Call immediately with current state
    if (currentUser !== undefined) {
        callback(currentUser);
    }
}

/**
 * Get user-friendly error message
 */
function getErrorMessage(error) {
    switch (error.code) {
        case 'auth/popup-closed-by-user':
            return 'Sign-in cancelled';
        case 'auth/popup-blocked':
            return 'Popup blocked. Please allow popups for this site.';
        case 'auth/account-exists-with-different-credential':
            return 'An account already exists with this email using a different sign-in method.';
        case 'auth/network-request-failed':
            return 'Network error. Please check your connection.';
        default:
            return error.message || 'An error occurred. Please try again.';
    }
}

/**
 * Update UI based on auth state
 */
function updateAuthUI(isLoggedIn, user) {
    const authBtn = document.getElementById('auth-button');
    const userAvatar = document.getElementById('user-avatar');
    const userMenu = document.getElementById('user-menu');
    
    if (authBtn) {
        if (isLoggedIn && user) {
            authBtn.classList.add('signed-in');
            authBtn.title = user.email;
            
            // Update avatar
            if (userAvatar) {
                if (user.photoURL) {
                    userAvatar.innerHTML = `<img src="${user.photoURL}" alt="Profile" />`;
                } else {
                    userAvatar.innerHTML = user.email.charAt(0).toUpperCase();
                }
            }
        } else {
            authBtn.classList.remove('signed-in');
            authBtn.title = 'Sign in';
            if (userAvatar) {
                userAvatar.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>`;
            }
        }
    }
}

/**
 * Show/hide auth loading state
 */
function showAuthLoading(show) {
    const modal = document.getElementById('auth-modal');
    if (modal) {
        modal.classList.toggle('loading', show);
    }
}

/**
 * Show auth error message
 */
function showAuthError(message) {
    const errorEl = document.getElementById('auth-error');
    if (errorEl) {
        errorEl.textContent = message;
        errorEl.style.display = 'block';
        setTimeout(() => {
            errorEl.style.display = 'none';
        }, 5000);
    }
}

/**
 * Open auth modal
 */
function openAuthModal() {
    const modal = document.getElementById('auth-modal');
    if (modal) {
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
}

/**
 * Close auth modal
 */
function closeAuthModal() {
    const modal = document.getElementById('auth-modal');
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = '';
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', initAuth);
