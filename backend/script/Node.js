// Quick fix script - Run this once
import mongoose from 'mongoose';

async function fixAuthTokenIndex() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI || 'your-mongodb-uri');

    const db = mongoose.connection.db;
    const collection = db.collection('authtokens');

    console.log('Dropping old tokenId index...');
    try {
      await collection.dropIndex('tokenId_1');
      console.log('✅ Dropped old tokenId_1 index');
    } catch (error) {
      if (error.message.includes('index not found')) {
        console.log('ℹ️ Index tokenId_1 not found');
      } else {
        throw error;
      }
    }

    console.log('Creating sparse unique index...');
    await collection.createIndex(
      { tokenId: 1 },
      {
        unique: true,
        sparse: true,
        name: 'tokenId_sparse_unique',
      }
    );
    console.log('✅ Created sparse unique index');

    console.log('✅ Fix completed successfully!');
  } catch (error) {
    console.error('❌ Fix failed:', error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

fixAuthTokenIndex();
