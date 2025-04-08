from typing import Dict, List, Optional, Any, Tuple
import openai
from pydantic import BaseModel
import os
from dotenv import load_dotenv
import json
import asyncio
import logging

# Configure logging
logger = logging.getLogger(__name__)

load_dotenv()

class Scenario(BaseModel):
    title: str
    description: str
    options: List[str]
    resource_impacts: Dict[str, Dict[str, int]]

class ScenarioGenerator:
    def __init__(self):
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            logger.error("OpenAI API key is not set in environment variables")
            raise ValueError("OpenAI API key is not set")
        logger.info("Initializing OpenAI client with API key: %s...", api_key[:8] + "..." if api_key else "None")
        try:
            # Initialize the client with async support
            self.client = openai.AsyncOpenAI(api_key=api_key)
            logger.info("OpenAI client initialized successfully")
        except Exception as e:
            logger.error("Failed to initialize OpenAI client: %s", str(e))
            logger.error("Error type: %s", type(e))
            logger.error("Error details: %s", e.__dict__)
            raise
        
    async def generate_scenario(self, game_state: Dict) -> Tuple[str, str]:
        """
        Generate a scenario title and description.
        Returns a tuple of (title, description).
        """
        prompt = self._create_scenario_prompt(game_state)
        logger.info("Generating scenario with prompt: %s", prompt)
        
        try:
            logger.info("Making OpenAI API call...")
            # Use async API call
            response = await self.client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {"role": "system", "content": "You are a creative game master generating scenarios for a futuristic government council game. Create engaging, morally complex situations that test the players' decision-making abilities but do so within 3-4 engaging sentences."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.8,
                max_tokens=10000
            )
            logger.info("OpenAI API call successful, processing response...")
            
            # Process response
            content = response.choices[0].message.content
            logger.info("Raw response content: %s", content)
            
            # Parse the content to extract title and description
            title = ""
            description = ""
            
            lines = content.split('\n')
            for line in lines:
                if line.startswith("TITLE:"):
                    title = line.replace("TITLE:", "").strip()
                elif line.startswith("DESCRIPTION:"):
                    description = line.replace("DESCRIPTION:", "").strip()
                elif description:  # If we're in the description section
                    description += " " + line.strip()
            
            # Clean up any remaining whitespace
            title = title.strip()
            description = description.strip()
            
            if not title or not description:
                logger.error("Failed to generate complete scenario: Title or description is empty")
                return self._create_fallback_scenario_text()
            
            logger.info(f"Generated scenario title: {title}")
            logger.info(f"Generated scenario description: {description}")
            
            return title, description
            
        except openai.AuthenticationError as e:
            logger.error(f"OpenAI Authentication Error: {str(e)}")
            return self._create_fallback_scenario_text()
        except openai.RateLimitError as e:
            logger.error(f"OpenAI Rate Limit Error: {str(e)}")
            return self._create_fallback_scenario_text()
        except openai.APIError as e:
            logger.error(f"OpenAI API Error: {str(e)}")
            return self._create_fallback_scenario_text()
        except Exception as e:
            logger.error(f"Unexpected error generating scenario: {str(e)}")
            logger.error(f"Error type: {type(e)}")
            logger.error(f"Error details: {e.__dict__}")
            return self._create_fallback_scenario_text()

    async def generate_voting_options(self, title: str, description: str) -> List[str]:
        """
        Generate voting options for the scenario.
        """
        try:
            prompt = f"""
            Create exactly 4 voting options for the following scenario:
            
            TITLE: {title}
            DESCRIPTION: {description}
            
            Each option should be a clear, concise action that the council could take.
            Format each option as a single line
            """
            
            # Use async API call
            response = await self.client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {"role": "system", "content": "You are a game master creating voting options for a government council game. Create exactly 4 distinct options that represent different approaches to the scenario."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.7,
                max_tokens=10000
            )
            
            # Parse the options from the response
            options_text = response.choices[0].message.content
            logger.info(f"Raw voting options response: {options_text}")
            
            options = []
            
            for line in options_text.split('\n'):
                line = line.strip()
                if line and any(line.startswith(f"{i}.") for i in range(1, 5)):
                    # Extract the option text (remove the number and period)
                    option_text = line.split('.', 1)[1].strip()
                    options.append(option_text)
            
            # Ensure we have exactly 4 options
            if len(options) < 4:
                # Add fallback options if needed
                while len(options) < 4:
                    options.append(f"Option {len(options) + 1}")
            elif len(options) > 4:
                # Trim to 4 options
                options = options[:4]
            
            logger.info(f"Generated voting options: {options}")
            return options
            
        except Exception as e:
            logger.error(f"Error generating voting options: {str(e)}")
            logger.error(f"Error type: {type(e)}")
            logger.error(f"Error details: {e.__dict__}")
            # Return fallback options
            return self._create_fallback_options()

    def _create_scenario_prompt(self, game_state: Dict) -> str:
        return f"""
        Create a new scenario for the government council game with the following context:
        
        Current Round: {game_state.get('current_round', 1)}
        Resources:
        - Tech: {game_state.get('resources', {}).get('tech', 100)}
        - Manpower: {game_state.get('resources', {}).get('manpower', 100)}
        - Economy: {game_state.get('resources', {}).get('economy', 100)}
        - Happiness: {game_state.get('resources', {}).get('happiness', 100)}
        - Trust: {game_state.get('resources', {}).get('trust', 100)}
        
        Number of Players: {len(game_state.get('players', {}))}
        
        Create a scenario that:
        1. Is morally complex and engaging
        2. Has clear resource implications
        3. Involves multiple stakeholders
        4. Has potential for betrayal or cooperation
        5. Themes of absurdity and scifi
        5. 3-4 engaging sentences
        
        Format the response as:
        TITLE: [A short, attention-grabbing title]
        DESCRIPTION: [A detailed description of the scenario]
        """

    def _create_fallback_scenario_text(self) -> Tuple[str, str]:
        return (
            "Critical System Failure",
            "A critical system failure threatens the city's power grid. The council must decide how to allocate limited resources to address this crisis."
        )

    def _create_fallback_options(self) -> List[str]:
        return [
            "Option 1",
            "Option 2",
            "Option 3",
            "Option 4"
        ]
        
    async def generate_voting_outcome(self, title: str, description: str, winning_option: str, vote_counts: Dict[str, int]) -> str:
        """
        Generate an outcome narrative based on the scenario and voting results.
        """
        try:
            # Format vote counts for the prompt
            vote_summary = "\n".join([f"- {option}: {count} votes" for option, count in vote_counts.items()])
            
            prompt = f"""
            Create a narrative outcome for the following scenario and voting results:
            
            TITLE: {title}
            DESCRIPTION: {description}
            
            VOTING RESULTS:
            {vote_summary}
            
            WINNING OPTION: {winning_option}
            
            Create a narrative that:
            1. Describes what happened after the council made their decision
            2. Explains the consequences of their choice
            3. Mentions how resources were affected (tech, manpower, economy, happiness, trust)
            4. Is 3-4 sentences long
            5. Has a dramatic and engaging tone
            """
            
            # Use async API call
            response = await self.client.chat.completions.create(
                model="gpt-4",
                messages=[
                    {"role": "system", "content": "You are a game master creating narrative outcomes for a government council game. Create engaging outcomes that describe the consequences of the council's decisions."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.7,
                max_tokens=500
            )
            
            # Get the outcome from the response
            outcome = response.choices[0].message.content.strip()
            logger.info(f"Generated voting outcome: {outcome}")
            
            return outcome
            
        except Exception as e:
            logger.error(f"Error generating voting outcome: {str(e)}")
            logger.error(f"Error type: {type(e)}")
            logger.error(f"Error details: {e.__dict__}")
            # Return a fallback outcome
            return self._create_fallback_outcome()
            
    def _create_fallback_outcome(self) -> str:
        return "The council's decision led to mixed results. Some resources were improved while others suffered. The situation remains unresolved, and the council must prepare for future challenges."

# Create a singleton instance
scenario_generator = ScenarioGenerator() 