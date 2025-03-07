const ALPHA_VANTAGE_KEYS = [
    "5XIBCMQHZT68WDNX",  // Primary API Key
    "QNI97H42OZVD4DGM",  // Backup API Key 1
    "63PJD9DJILBNOWI2",  // Backup API Key 2
    "YC0AK9L4LOYKL8TT"   // Backup API Key 3
];

const CORS_PROXY = "https://api.allorigins.win/raw?url=";  // Fixes CORS issues

// Function to trigger search when Enter key is pressed
function handleKeyPress(event) {
    if (event.key === "Enter") {
        getStockPrediction();
    }
}

// Main function to get stock prediction
async function getStockPrediction() {
    let stockSymbol = document.getElementById("stockSymbol").value.trim().toUpperCase();
    if (!stockSymbol) {
        alert("Please enter a stock symbol (e.g., AAPL, TSLA, MSFT)!");
        return;
    }

    document.getElementById("updateMessage").innerHTML = "📊 Fetching stock data...";

    let stockData = await fetchStockData(stockSymbol);
    if (!stockData) {
        document.getElementById("updateMessage").innerHTML = `<p style="color:red;">❌ Error: Unable to fetch data. Please try again later.</p>`;
        return;
    }

    document.getElementById("updateMessage").innerHTML = "✅ Prediction completed!";
    document.getElementById("stockData").innerHTML = `
        <h2>${stockSymbol}</h2>
        <p><b>Latest Price:</b> $${stockData.latestPrice.toFixed(2)}</p>
        <p><b>Predicted Next Day Price:</b> $${stockData.predictedPrice.toFixed(2)}</p>
        <p><b>Buy/Sell/Hold:</b> ${stockData.signal}</p>
        <h3>Technical Indicators:</h3>
        <p><b>SMA (5-day):</b> ${stockData.SMA}</p>
        <p><b>EMA (5-day):</b> ${stockData.EMA}</p>
        <p><b>RSI (14-day):</b> ${stockData.RSI}</p>
    `;

    document.getElementById("stockData").classList.add("show");
}

// Fetch stock data using Alpha Vantage (API rotation logic)
async function fetchStockData(symbol) {
    let attempt = 0;
    let maxRetries = ALPHA_VANTAGE_KEYS.length;

    // Try fetching data from multiple keys if one fails
    while (attempt < maxRetries) {
        let apiKey = ALPHA_VANTAGE_KEYS[attempt % ALPHA_VANTAGE_KEYS.length]; // Rotate API keys
        try {
            let response = await fetch(`${CORS_PROXY}https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${symbol}&apikey=${apiKey}`);
            let data = await response.json();
            console.log(`Alpha Vantage Stock API Response (Attempt ${attempt + 1}):`, data);

            if (data["Time Series (Daily)"]) {
                let latestPrice = parseFloat(Object.values(data["Time Series (Daily)"])[0]["4. close"]);

                // Fetch actual technical indicators
                let indicators = await fetchTechnicalIndicators(symbol, apiKey);

                // Train the ML model and make a prediction
                let predictedPrice = await predictStockPrice([indicators.SMA, indicators.EMA, indicators.RSI]);

                // Generate Buy/Sell/Hold Signal based on the predicted price
                let signal = predictedPrice > latestPrice ? "BUY 📈" : "SELL 📉";

                return {
                    latestPrice,
                    predictedPrice,
                    SMA: indicators.SMA,
                    EMA: indicators.EMA,
                    RSI: indicators.RSI,
                    signal
                };
            }

            console.warn(`❌ Alpha Vantage API attempt ${attempt + 1} failed. Retrying with the next API key...`);
            attempt++;
        } catch (error) {
            console.warn(`❌ Error fetching stock data from Alpha Vantage (Attempt ${attempt + 1}):`, error);
            attempt++;
        }
    }

    // If all attempts fail, fallback to Yahoo Finance
    return await fetchStockDataYahoo(symbol);
}

// Fetch technical indicators (SMA, EMA, RSI) using Alpha Vantage
async function fetchTechnicalIndicators(symbol, apiKey) {
    let indicators = { SMA: "N/A", EMA: "N/A", RSI: "N/A" };

    try {
        let response = await fetch(`${CORS_PROXY}https://www.alphavantage.co/query?function=SMA&symbol=${symbol}&interval=daily&time_period=5&series_type=close&apikey=${apiKey}`);
        let data = await response.json();
        if (data["Technical Analysis: SMA"]) {
            let lastKey = Object.keys(data["Technical Analysis: SMA"])[0];
            indicators.SMA = parseFloat(data["Technical Analysis: SMA"][lastKey]["SMA"]);
        }

        response = await fetch(`${CORS_PROXY}https://www.alphavantage.co/query?function=EMA&symbol=${symbol}&interval=daily&time_period=5&series_type=close&apikey=${apiKey}`);
        data = await response.json();
        if (data["Technical Analysis: EMA"]) {
            let lastKey = Object.keys(data["Technical Analysis: EMA"])[0];
            indicators.EMA = parseFloat(data["Technical Analysis: EMA"][lastKey]["EMA"]);
        }

        response = await fetch(`${CORS_PROXY}https://www.alphavantage.co/query?function=RSI&symbol=${symbol}&interval=daily&time_period=14&series_type=close&apikey=${apiKey}`);
        data = await response.json();
        if (data["Technical Analysis: RSI"]) {
            let lastKey = Object.keys(data["Technical Analysis: RSI"])[0];
            indicators.RSI = parseFloat(data["Technical Analysis: RSI"][lastKey]["RSI"]);
        }
    } catch (error) {
        console.error("Error fetching indicators:", error);
    }

    return indicators;
}

// Linear Regression using TensorFlow.js for stock price prediction
async function predictStockPrice(features) {
    const model = await createModel();
    const prediction = model.predict(tf.tensor([features]));
    return prediction.dataSync()[0];  // Return the predicted price
}

// Create a simple linear regression model with TensorFlow.js
function createModel() {
    const model = tf.sequential();
    model.add(tf.layers.dense({ units: 1, inputShape: [3] }));  // 3 features (SMA, EMA, RSI)
    model.compile({ optimizer: 'sgd', loss: 'meanSquaredError' });

    // Dummy data for training (you should train on real data)
    const xs = tf.tensor([
        [100, 102, 50],
        [105, 106, 51],
        [110, 111, 52],
        [120, 121, 53],
        [125, 126, 55]
    ]);
    const ys = tf.tensor([102, 107, 112, 122, 127]);  // Example target prices

    return model.fit(xs, ys, { epochs: 500 }).then(() => model);  // Train the model and return it
}

// Fetch stock data using Yahoo Finance as a fallback method
async function fetchStockDataYahoo(symbol) {
    try {
        let response = await fetch(`${CORS_PROXY}https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=1d&interval=1m`);
        let data = await response.json();
        console.log("Yahoo Finance Stock API Response:", data);

        if (data.chart && data.chart.result) {
            let latestPrice = data.chart.result[0].meta.regularMarketPrice;

            // Dummy technical indicators for now
            let sma = 100;  // Sample SMA value
            let ema = 102;  // Sample EMA value
            let rsi = 50;   // Sample RSI value

            let predictedPrice = latestPrice + (Math.random() * 5); // Dummy prediction for illustration

            let signal = predictedPrice > latestPrice ? "BUY 📈" : "SELL 📉";

            return {
                latestPrice,
                predictedPrice,
                SMA: sma,
                EMA: ema,
                RSI: rsi,
                signal
            };
        }

        return null;
    } catch (error) {
        console.warn("❌ Error fetching stock data from Yahoo Finance:", error);
        return null;
    }
}
