# Production Tracker

A comprehensive React application for tracking manufacturing production performance with a daily 525-minute target.

## Features

- **User Authentication**: Simple login system with name and email
- **Production Tracking**: Log completed work with item codes and quantities
- **Loss Time Tracking**: Record downtime with categorized reasons
- **Progress Visualization**: Real-time charts and progress indicators
- **Daily Summary**: Comprehensive reports of completed jobs and loss time
- **Responsive Design**: Works on desktop and mobile devices

## Getting Started

### Prerequisites

- Node.js (version 14 or higher)
- npm or yarn

### Installation

1. Clone the repository or navigate to the project directory
2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm start
   ```

4. Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

## Usage

### Login
- Enter your name and email address to start tracking
- Data is stored locally during the session only

### Production Tracking
- Select items from the dropdown or use quick search
- Enter the number of units completed
- The system automatically calculates time based on target quantities

### Loss Time Tracking
- Click "Add Loss Time" to record downtime
- Select a reason from predefined categories
- Enter the number of minutes lost
- Loss time reduces your daily target accordingly

### Progress Monitoring
- View real-time progress with visual charts
- Monitor target completion percentage
- Track remaining time to reach daily goal

## Technology Stack

- **React 18**: Modern React with hooks
- **TypeScript**: Type-safe development
- **Tailwind CSS**: Utility-first CSS framework
- **Recharts**: Data visualization library
- **Lucide React**: Icon library

## Project Structure

```
src/
├── components/
│   └── ProductionTracker.tsx  # Main application component
├── App.tsx                    # Root component
├── index.tsx                  # Application entry point
└── index.css                  # Global styles with Tailwind
```

## Features in Detail

### Production Data
The application includes a comprehensive database of manufacturing items with:
- Item codes (e.g., B102823)
- LM codes (e.g., AHOOK-TI)
- Target quantities
- Standard time allocations

### Loss Time Categories
Predefined reasons for downtime tracking:
- Waiting for Parts
- Waiting Jobs
- Cleaning
- Maintenance
- Machine Error
- Needle Change
- Full Track
- Back Rack
- Other

### Progress Calculation
- **Target**: 525 minutes per day
- **Adjusted Target**: Reduced by total loss time
- **Progress**: (Completed minutes / Adjusted target) × 100%

## Development

### Available Scripts

- `npm start`: Runs the app in development mode
- `npm build`: Builds the app for production
- `npm test`: Launches the test runner
- `npm eject`: Ejects from Create React App (not recommended)

### Customization

To modify the production data or loss time categories, edit the arrays in `src/components/ProductionTracker.tsx`:

- `productionData`: Add or modify item entries
- `lossReasons`: Update loss time categories
- `TARGET_MINUTES`: Change the daily target

## License

This project is for internal use and demonstration purposes. 