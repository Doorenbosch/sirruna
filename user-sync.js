/**
 * User Sync Module - The Litmus
 * Handles syncing user preferences to Firestore
 */

// Cached user data
let userData = null;

/**
 * Load user data from Firestore
 */
async function loadUserData(userId) {
    try {
        const userRef = db.collection('users').doc(userId);
        const doc = await userRef.get();
        
        if (doc.exists) {
            userData = doc.data();
            console.log('[Sync] User data loaded:', userData);
            
            // Update localStorage as cache
            if (userData.focusCoins) {
                localStorage.setItem('litmus_focus_coins', JSON.stringify(userData.focusCoins));
            }
            if (userData.region) {
                localStorage.setItem('litmus_region', userData.region);
            }
            
            // Dispatch event for other scripts to react
            window.dispatchEvent(new CustomEvent('userDataLoaded', { detail: userData }));
            
            return userData;
        } else {
            console.log('[Sync] No user document found');
            return null;
        }
    } catch (error) {
        console.error('[Sync] Error loading user data:', error);
        return null;
    }
}

/**
 * Save focus coins to Firestore
 */
async function saveFocusCoins(coins) {
    // Always save to localStorage (offline fallback)
    localStorage.setItem('litmus_focus_coins', JSON.stringify(coins));
    
    // If signed in, sync to Firestore
    const user = getCurrentUser();
    if (user) {
        try {
            const userRef = db.collection('users').doc(user.uid);
            await userRef.update({
                focusCoins: coins,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            console.log('[Sync] Focus coins saved to cloud');
        } catch (error) {
            console.error('[Sync] Error saving focus coins:', error);
        }
    }
}

/**
 * Get focus coins (from cloud or localStorage)
 */
function getFocusCoins() {
    if (userData?.focusCoins) {
        return userData.focusCoins;
    }
    return JSON.parse(localStorage.getItem('litmus_focus_coins') || '["BTC", "ETH"]');
}

/**
 * Save region preference
 */
async function saveRegion(region) {
    // Always save to localStorage
    localStorage.setItem('litmus_region', region);
    
    // If signed in, sync to Firestore
    const user = getCurrentUser();
    if (user) {
        try {
            const userRef = db.collection('users').doc(user.uid);
            await userRef.update({
                region: region,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            console.log('[Sync] Region saved to cloud');
        } catch (error) {
            console.error('[Sync] Error saving region:', error);
        }
    }
}

/**
 * Get region preference
 */
function getRegion() {
    if (userData?.region) {
        return userData.region;
    }
    return localStorage.getItem('litmus_region') || 'americas';
}

/**
 * Get account type
 */
function getAccountType() {
    return userData?.accountType || 'free';
}

/**
 * Check if user has premium access
 */
function isPremium() {
    return userData?.accountType === 'premium' || userData?.accountType === 'paid';
}

/**
 * Listen for real-time updates to user data
 */
function subscribeToUserData(userId) {
    const userRef = db.collection('users').doc(userId);
    
    return userRef.onSnapshot((doc) => {
        if (doc.exists) {
            userData = doc.data();
            console.log('[Sync] Real-time update received');
            
            // Update localStorage cache
            if (userData.focusCoins) {
                localStorage.setItem('litmus_focus_coins', JSON.stringify(userData.focusCoins));
            }
            if (userData.region) {
                localStorage.setItem('litmus_region', userData.region);
            }
            
            // Dispatch event
            window.dispatchEvent(new CustomEvent('userDataUpdated', { detail: userData }));
        }
    }, (error) => {
        console.error('[Sync] Real-time listener error:', error);
    });
}

/**
 * Add a coin to focus list
 */
async function addFocusCoin(coinId) {
    const coins = getFocusCoins();
    if (!coins.includes(coinId)) {
        coins.push(coinId);
        await saveFocusCoins(coins);
        return true;
    }
    return false;
}

/**
 * Remove a coin from focus list
 */
async function removeFocusCoin(coinId) {
    let coins = getFocusCoins();
    const index = coins.indexOf(coinId);
    if (index > -1) {
        coins.splice(index, 1);
        await saveFocusCoins(coins);
        return true;
    }
    return false;
}

/**
 * Reorder focus coins
 */
async function reorderFocusCoins(newOrder) {
    await saveFocusCoins(newOrder);
}

// Export for global access
window.userSync = {
    loadUserData,
    saveFocusCoins,
    getFocusCoins,
    saveRegion,
    getRegion,
    getAccountType,
    isPremium,
    addFocusCoin,
    removeFocusCoin,
    reorderFocusCoins
};
