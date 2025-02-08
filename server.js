import express from 'express';
import { MongoClient, ServerApiVersion, ObjectId } from 'mongodb';
import cors from 'cors';
import * as dotenv from 'dotenv';
dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const uri = process.env.MONGODB_URI;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server
        await client.connect();
        console.log("Successfully connected to MongoDB!"); // Log successful connection

        // Test the connection (optional but recommended)
        try {
            await client.db("admin").command({ ping: 1 });
            console.log("Pinged your deployment. You successfully connected to MongoDB!");
        } catch (err) {
            console.error("Failed to ping MongoDB:", err);
            process.exit(1);  // Exit on ping failure
        }

        const db = client.db("chatAppDB"); // Replace with your DB name
        const chatsCollection = db.collection("chats");

        // API Endpoints

        // GET chats for a specific user (uniqueId)
        app.get('/chats/:userId', async (req, res) => {
            const userId = req.params.userId;
            try {
                const chats = await chatsCollection.find({ userId: userId }).sort({ createdAt: -1 }).toArray();
                console.log(`Successfully fetched chats for user: ${userId}`);  // Log success
                res.json(chats);
            } catch (error) {
                console.error(`Error fetching chats for user ${userId}:`, error);
                res.status(500).json({ message: "Failed to fetch chats" });
            }
        });

        // POST a new chat or update an existing chat
        app.post('/chats', async (req, res) => {
            const chatData = req.body;

            try {
                const { _id, ...chatDataWithoutId } = chatData; // Remove _id to prevent overwriting
                const result = await chatsCollection.updateOne(
                    { userId: chatData.userId, id: chatData.id }, // Filter by userId AND chatId
                    { $set: chatDataWithoutId },
                    { upsert: true }
                );

                console.log(`Chat saved/updated successfully for user ${chatData.userId}, chat ID ${chatData.id}`); // Log success

                res.json({
                    message: "Chat saved/updated successfully",
                    upsertedId: result.upsertedId,
                    modifiedCount: result.modifiedCount,
                });
            } catch (error) {
                console.error("Error saving/updating chat:", error);
                res.status(500).json({ message: "Failed to save/update chat" });
            }
        });

        // DELETE a chat by its ID and userId
        app.delete('/chats/:userId/:chatId', async (req, res) => {
            const { userId, chatId } = req.params;

            try {
                const result = await chatsCollection.deleteOne({ userId: userId, id: chatId });

                if (result.deletedCount === 1) {
                    console.log(`Chat deleted successfully for user ${userId}, chat ID ${chatId}`); // Log success
                    res.json({ message: 'Chat deleted successfully' });
                } else {
                    console.log(`Chat not found for deletion: user ${userId}, chat ID ${chatId}`);
                    res.status(404).json({ message: 'Chat not found' });
                }
            } catch (error) {
                console.error('Error deleting chat:', error);
                res.status(500).json({ message: 'Failed to delete chat' });
            }
        });

        // PUT update a message
        app.put('/chats/:userId/:chatId/messages/:messageIndex', async (req, res) => {
            const { userId, chatId, messageIndex } = req.params;
            const { content } = req.body; // Expect the new content in the request body

            try {
                //find the chat to update
                const chat = await chatsCollection.findOne({ userId: userId, id: chatId });

                if (!chat) {
                    return res.status(404).json({ message: 'Chat not found' });
                }

                //Verify that the messageIndex is valid
                if (messageIndex < 0 || messageIndex >= chat.messages.length) {
                    return res.status(400).json({ message: 'Invalid message index' });
                }

                // Update the specific message
                chat.messages[parseInt(messageIndex)].content = content;

                // Update the chat in the database
                const result = await chatsCollection.updateOne(
                    { userId: userId, id: chatId },
                    { $set: { messages: chat.messages } } // Update the entire messages array
                );

                if (result.modifiedCount === 1) {
                    console.log(`Message updated successfully in chat ${chatId}, message index ${messageIndex}`);
                    res.json({ message: 'Message updated successfully' });
                } else {
                    console.log(`Chat not updated for user ${userId}, chat ID ${chatId}, message index ${messageIndex}`);
                    res.status(404).json({ message: 'Chat not updated' });
                }


            } catch (error) {
                console.error('Error updating chat:', error);
                res.status(500).json({ message: 'Failed to update chat' });
            }
        });

    } catch (error) {
        console.error("Error during server setup:", error);  // Log setup errors
        process.exit(1); // Exit process if server cannot start correctly
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close(); // Remove closing the client here - let the server handle it
    }
}
run().catch(console.dir);

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
