package com.sdidsa.dentacore.ui.dynamic.style;

import javafx.scene.paint.Color;
import java.util.HashMap;
import java.util.Map;
import java.util.function.Function;

public class FlexibleStyleGenerator {
    
    // Theme configuration maps
    private static final Map<StyleMode, ThemeConfig> THEME_CONFIGS = new HashMap<>();
    
    static {
        // Dark theme configuration
        THEME_CONFIGS.put(StyleMode.DARK, new ThemeConfig()
            .background("#0f172a", "#1e293b", "#334155", "#1e293b")
            .surface("#1e293b", "#334155", "#475569")
            .text("#f8fafc", "#e2e8f0", "#cbd5e1", "#94a3b8", "#64748b")
            .border("#334155", "#475569", "#536073")
            .status("#10b981", "#34d399", "#f59e0b", "#fbbf24", "#FF5959", "#f87171")
            .semantic("#8b5cf6")
        );
        
        // Light theme configuration
        THEME_CONFIGS.put(StyleMode.LIGHT, new ThemeConfig()
            .background("#ffffff", "#f8fafc", "#f1f5f9", "#ffffff")
            .surface("#ffffff", "#f8fafc", "#f1f5f9")
            .text("#0f172a", "#334155", "#475569", "#64748b", "#94a3b8")
            .border("#dadada", "#f1f5f9", "#cbd5e1")
            .status("#059669", "#10b981", "#d97706", "#f59e0b", "#dc2626", "#ef4444")
            .semantic("#7c3aed")
        );
        
        // Gray theme configuration
        THEME_CONFIGS.put(StyleMode.GRAY, new ThemeConfig()
            .background("#2a2d3a", "#363a4a", "#434754", "#363a4a")
            .surface("#363a4a", "#434754", "#4f546a")
            .text("#e8eaed", "#d1d5db", "#9ca3af", "#6b7280", "#4b5563")
            .border("#434754", "#4f546a", "#6b7280")
            .status("#22c55e", "#4ade80", "#eab308", "#facc15", "#f87171", "#fca5a5")
            .semantic("#8b5cf6")
        );
    }
    
    public static Map<String, Color> generateTheme(StyleMode mode, Color accent) {
        ThemeConfig config = THEME_CONFIGS.get(mode);
        if (config == null) {
            throw new IllegalArgumentException("Unsupported style mode: " + mode);
        }
        
        Map<String, Color> colors = new HashMap<>();
        
        // Generate accent variations
        colors.put("primary", accent);
        colors.put("primaryLight", lighten(accent, 0.15f));
        colors.put("primaryDark", darken(accent, 0.15f));
        
        // Apply theme configuration
        colors.putAll(config.generateColors());
        
        // Generate semantic colors
        generateSemanticColors(colors, accent, config);
        
        return colors;
    }
    
    private static void generateSemanticColors(Map<String, Color> colors, Color accent, ThemeConfig config) {
        colors.put("info", accent);
        colors.put("paid", colors.get("success"));
        colors.put("pending", colors.get("warning"));
        colors.put("confirmed", accent);
        colors.put("completed", colors.get("success"));
        colors.put("scheduled", config.scheduledColor);
    }
    
    // Color manipulation utilities
    public static Color lighten(Color color, float factor) {
        return adjustBrightness(color, factor, true);
    }
    
    public static Color darken(Color color, float factor) {
        return adjustBrightness(color, factor, false);
    }
    
    private static Color adjustBrightness(Color color, float factor, boolean lighten) {
        double r, g, b;
        
        if (lighten) {
            r = Math.min(1.0, color.getRed() + (1.0 - color.getRed()) * factor);
            g = Math.min(1.0, color.getGreen() + (1.0 - color.getGreen()) * factor);
            b = Math.min(1.0, color.getBlue() + (1.0 - color.getBlue()) * factor);
        } else {
            r = Math.max(0.0, color.getRed() * (1.0 - factor));
            g = Math.max(0.0, color.getGreen() * (1.0 - factor));
            b = Math.max(0.0, color.getBlue() * (1.0 - factor));
        }
        
        return Color.color(r, g, b, color.getOpacity());
    }
    
    // Utility methods for color generation
    public static Color blend(Color color1, Color color2, double ratio) {
        double r = color1.getRed() * (1 - ratio) + color2.getRed() * ratio;
        double g = color1.getGreen() * (1 - ratio) + color2.getGreen() * ratio;
        double b = color1.getBlue() * (1 - ratio) + color2.getBlue() * ratio;
        double a = color1.getOpacity() * (1 - ratio) + color2.getOpacity() * ratio;
        return Color.color(r, g, b, a);
    }
    
    public static Color withOpacity(Color color, double opacity) {
        return Color.color(color.getRed(), color.getGreen(), color.getBlue(), opacity);
    }
    
    // Configuration class for theme definitions
    private static class ThemeConfig {
        // Background colors
        Color backgroundPrimary, backgroundSecondary, backgroundTertiary, backgroundCard;
        
        // Surface colors
        Color surfaceDefault, surfaceElevated, surfaceSubtle;
        
        // Text colors
        Color textPrimary, textSecondary, textTertiary, textMuted, textDisabled;
        
        // Border colors
        Color borderDefault, borderSubtle, borderStrong;
        
        // Status colors
        Color success, successLight, warning, warningLight, error, errorLight;
        
        // Semantic colors
        Color scheduledColor;
        
        ThemeConfig background(String primary, String secondary, String tertiary, String card) {
            this.backgroundPrimary = Color.web(primary);
            this.backgroundSecondary = Color.web(secondary);
            this.backgroundTertiary = Color.web(tertiary);
            this.backgroundCard = Color.web(card);
            return this;
        }
        
        ThemeConfig surface(String defaultColor, String elevated, String subtle) {
            this.surfaceDefault = Color.web(defaultColor);
            this.surfaceElevated = Color.web(elevated);
            this.surfaceSubtle = Color.web(subtle);
            return this;
        }
        
        ThemeConfig text(String primary, String secondary, String tertiary, String muted, String disabled) {
            this.textPrimary = Color.web(primary);
            this.textSecondary = Color.web(secondary);
            this.textTertiary = Color.web(tertiary);
            this.textMuted = Color.web(muted);
            this.textDisabled = Color.web(disabled);
            return this;
        }
        
        ThemeConfig border(String defaultColor, String subtle, String strong) {
            this.borderDefault = Color.web(defaultColor);
            this.borderSubtle = Color.web(subtle);
            this.borderStrong = Color.web(strong);
            return this;
        }
        
        ThemeConfig status(String success, String successLight, String warning, 
                          String warningLight, String error, String errorLight) {
            this.success = Color.web(success);
            this.successLight = Color.web(successLight);
            this.warning = Color.web(warning);
            this.warningLight = Color.web(warningLight);
            this.error = Color.web(error);
            this.errorLight = Color.web(errorLight);
            return this;
        }
        
        ThemeConfig semantic(String scheduled) {
            this.scheduledColor = Color.web(scheduled);
            return this;
        }
        
        Map<String, Color> generateColors() {
            Map<String, Color> colors = new HashMap<>();
            
            // Background colors
            colors.put("backgroundPrimary", backgroundPrimary);
            colors.put("backgroundSecondary", backgroundSecondary);
            colors.put("backgroundTertiary", backgroundTertiary);
            colors.put("backgroundCard", backgroundCard);
            
            // Surface colors
            colors.put("surfaceDefault", surfaceDefault);
            colors.put("surfaceElevated", surfaceElevated);
            colors.put("surfaceSubtle", surfaceSubtle);
            
            // Text colors
            colors.put("textPrimary", textPrimary);
            colors.put("textSecondary", textSecondary);
            colors.put("textTertiary", textTertiary);
            colors.put("textMuted", textMuted);
            colors.put("textDisabled", textDisabled);
            
            // Border colors
            colors.put("borderDefault", borderDefault);
            colors.put("borderSubtle", borderSubtle);
            colors.put("borderStrong", borderStrong);
            
            // Status colors
            colors.put("success", success);
            colors.put("successLight", successLight);
            colors.put("warning", warning);
            colors.put("warningLight", warningLight);
            colors.put("error", error);
            colors.put("errorLight", errorLight);
            
            return colors;
        }
    }
}