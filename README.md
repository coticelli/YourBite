# YourBite
PaymentMethods

{
  "PaymentMethods": [
    {
      "Type": "CreditCard",
      "Details": {
        "CardNumber": "XXXX-XXXX-XXXX-XXXX",
        "ExpiryDate": "12/24",
        "CVV": "123"
      }
    },
    {
      "Type": "PayPal",
      "Details": {
        "Email": "user@example.com"
      }
    },
    {
      "Type": "DigitalWallet",
      "Details": {
        "WalletID": "wallet123456789"
      }
    }
  ]
}

WalletRecharge

{
  "WalletRecharge": {
    "Amount": 100.00,
    "PaymentMethod": "Cash",
    "Location": "Piazza Grasso 537, Borgo Donatella, CB 40928"
  }
}

RestaurantAPI
{
  "RestaurantAPI": {
    "RestaurantID": "12345",
    "Menu": [
      {
        "ItemID": "item001",
        "Name": "Burger",
        "Price": 8.99,
        "Ingredients": ["Beef", "Lettuce", "Tomato", "Cheese"]
      },
      {
        "ItemID": "item002",
        "Name": "Pizza",
        "Price": 12.99,
        "Ingredients": ["Tomato Sauce", "Mozzarella", "Pepperoni"]
      }
    ],
    "Order": {
      "OrderID": "order123",
      "CustomerID": "zio",
      "Items": [
        {
          "ItemID": "item001",
          "Quantity": 2
        },
        {
          "ItemID": "item002",
          "Quantity": 1
        }
      ],
      "Status": "Preparation"
    }
  }
}

InternetConnection
{
  "InternetConnection": {
    "Status": "Connected",
    "Speed": "50Mbps"
  }
}

IngredientDatabase
{
  "IngredientDatabase": {
    "Ingredients": [
      {
        "IngredientID": "ing001",
        "Name": "Beef",
        "Allergens": ["None"],
        "NutritionalValues": {
          "Calories": 250,
          "Proteins": 20,
          "Carbs": 5,
          "Fats": 15
        }
      },
      {
        "IngredientID": "ing002",
        "Name": "Lettuce",
        "Allergens": ["None"],
        "NutritionalValues": {
          "Calories": 10,
          "Proteins": 1,
          "Carbs": 2,
          "Fats": 0.5
        }
      }
    ]
  }
}

OrderNotifications
{
  "OrderNotifications": {
    "OrderID": "order123",
    "Status": "Delivered",
    "Timestamp": "2023-10-01T12:30:00Z",
    "Message": "Your order has been delivered successfully."
  }
}

SupportPage
{
  "SupportPage": {
    "FAQ": [
      {
        "Question": "How can I track my order?",
        "Answer": "You can track your order by clicking on the 'Track Order' link in your order confirmation email."
      }
    ],
    "LiveChat": {
      "Status": "Online",
      "AgentName": "John Doe"
    },
    "EmailSupport": "support@example.com",
    "PhoneSupport": "+12 345 678 9"
  }
}

RegistrationLogin
{
  "Registration": {
    "Email": "user@example.com",
    "Password": "password123",
    "PhoneNumber": "+12 345 678 9",
    "SocialMedia": ["Facebook", "Google"]
  },
  "Login": {
    "Email": "user@example.com",
    "Password": "password123"
  }
}

LoyaltyProgram
{
  "LoyaltyProgram": {
    "UserID": "zio",
    "Points": 150,
    "Rewards": [
      {
        "RewardID": "reward001",
        "Description": "10% off on your next order",
		}
	}
}

