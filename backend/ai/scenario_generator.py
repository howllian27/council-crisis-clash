from typing import Dict, List
import openai
from pydantic import BaseModel
import os
from dotenv import load_dotenv

load_dotenv()

class Scenario(BaseModel):
    description: str
    options: List[str]
    resource_impacts: Dict[str, Dict[str, int]]

class ScenarioGenerator:
    def __init__(self):
        self.client = openai.OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
        
    async def generate_scenario(self, game_state: Dict) -> Scenario:
        prompt = self._create_scenario_prompt(game_state)
        
        try:
            response = await self.client.chat.completions.create(
                model="gpt-4",
                messages=[
                    {"role": "system", "content": "You are a creative game master generating scenarios for a futuristic government council game. Create engaging, morally complex situations that test the players' decision-making abilities."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.8,
                max_tokens=1000
            )
            
            # Parse the response and create a Scenario object
            # This is a simplified version - you'll need to implement proper parsing
            scenario_text = response.choices[0].message.content
            return self._parse_scenario(scenario_text)
            
        except Exception as e:
            print(f"Error generating scenario: {e}")
            # Return a fallback scenario
            return self._create_fallback_scenario()

    def _create_scenario_prompt(self, game_state: Dict) -> str:
        return f"""
        Create a new scenario for the government council game with the following context:
        
        Current Round: {game_state['current_round']}
        Resources:
        - Tech: {game_state['resources']['tech']}
        - Manpower: {game_state['resources']['manpower']}
        - Economy: {game_state['resources']['economy']}
        - Happiness: {game_state['resources']['happiness']}
        - Trust: {game_state['resources']['trust']}
        
        Number of Players: {len(game_state['players'])}
        
        Create a scenario that:
        1. Is morally complex and engaging
        2. Has clear resource implications
        3. Involves multiple stakeholders
        4. Has at least 2 distinct options
        5. Includes potential for betrayal or cooperation
        
        Format the response as:
        SCENARIO: [description]
        OPTIONS:
        1. [option 1]
        2. [option 2]
        IMPACTS:
        Option 1:
        - Tech: [change]
        - Manpower: [change]
        - Economy: [change]
        - Happiness: [change]
        - Trust: [change]
        
        Option 2:
        - Tech: [change]
        - Manpower: [change]
        - Economy: [change]
        - Happiness: [change]
        - Trust: [change]
        """

    def _parse_scenario(self, text: str) -> Scenario:
        # Implement proper parsing logic here
        # This is a placeholder implementation
        lines = text.split('\n')
        description = ""
        options = []
        impacts = {}
        
        current_section = None
        for line in lines:
            if line.startswith("SCENARIO:"):
                current_section = "description"
                description = line.replace("SCENARIO:", "").strip()
            elif line.startswith("OPTIONS:"):
                current_section = "options"
            elif line.startswith("IMPACTS:"):
                current_section = "impacts"
            elif line.strip() and current_section == "options":
                options.append(line.strip())
            elif line.strip() and current_section == "impacts":
                # Parse impacts
                pass
        
        return Scenario(
            description=description,
            options=options,
            resource_impacts=impacts
        )

    def _create_fallback_scenario(self) -> Scenario:
        return Scenario(
            description="A critical system failure threatens the city's power grid. The council must decide how to allocate limited resources to address this crisis.",
            options=[
                "Divert resources from other sectors to fix the power grid immediately",
                "Implement rolling blackouts and gradually repair the system"
            ],
            resource_impacts={
                "Option 1": {
                    "tech": -20,
                    "manpower": -15,
                    "economy": -25,
                    "happiness": -30,
                    "trust": -10
                },
                "Option 2": {
                    "tech": -10,
                    "manpower": -5,
                    "economy": -15,
                    "happiness": -40,
                    "trust": -20
                }
            }
        )

scenario_generator = ScenarioGenerator() 